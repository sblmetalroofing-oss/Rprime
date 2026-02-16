import { Router } from "express";
import { getOrganizationId, canUserDelete } from "./middleware";
import { checkRateLimit } from "./rateLimiter";
import { storage } from "../storage";
import OpenAI from "openai";
import type { ChatCompletionContentPart } from "openai/resources/chat/completions";
import { promises as fs } from "fs";
import { randomUUID } from "crypto";
import { ObjectStorageService, objectStorageClient } from "../replit_integrations/object_storage";

interface Finding {
  category: string;
  severity: string;
  description: string;
  recommendation: string;
}

interface EstimateItem {
  description: string;
  qty: number;
  unitCost: number;
}

interface HistoricalContext {
  quotesAnalyzed: number;
  importedPatterns: number;
  avgQuoteTotal: number;
  avgItemCount: number;
  itemPatterns: Record<string, { avgPrice: number; avgQty: number; count: number }>;
}

interface GeneratedQuoteItem {
  id: string;
  description: string;
  qty: number;
  unitCost: number;
  total: number;
  itemCode: string | null;
  costPrice: number | null;
  productId: string | null;
  sortOrder: number;
  measurementType: string;
  measurementValue: number;
  laborCost: number | null;
  historicalPricing: { avgPrice: number; avgQty: number; count: number } | null;
}

interface SuggestedMapping {
  measurementType: string;
  productId?: string;
  productDescription: string;
  calculationType?: string;
  coveragePerUnit?: number;
  unitPrice?: number;
  customFormula?: string;
  applyWaste?: boolean;
}

function safeEvaluateMath(expr: string): number {
  const tokens = expr.match(/(\d+\.?\d*|\+|-|\*|\/|\(|\))/g);
  if (!tokens) throw new Error('Invalid expression');
  let pos = 0;

  function parseExpr(): number {
    let result = parseTerm();
    while (pos < tokens!.length && (tokens![pos] === '+' || tokens![pos] === '-')) {
      const op = tokens![pos++];
      const right = parseTerm();
      result = op === '+' ? result + right : result - right;
    }
    return result;
  }

  function parseTerm(): number {
    let result = parseFactor();
    while (pos < tokens!.length && (tokens![pos] === '*' || tokens![pos] === '/')) {
      const op = tokens![pos++];
      const right = parseFactor();
      if (op === '/') {
        if (right === 0) throw new Error('Division by zero');
        result = result / right;
      } else {
        result = result * right;
      }
    }
    return result;
  }

  function parseFactor(): number {
    if (tokens![pos] === '(') {
      pos++;
      const result = parseExpr();
      if (tokens![pos] !== ')') throw new Error('Mismatched parentheses');
      pos++;
      return result;
    }
    if (tokens![pos] === '-') {
      pos++;
      return -parseFactor();
    }
    const num = parseFloat(tokens![pos++]);
    if (isNaN(num)) throw new Error('Invalid number');
    return num;
  }

  const result = parseExpr();
  if (pos !== tokens.length) throw new Error('Unexpected tokens');
  return result;
}

const router = Router();
const objectStorageService = new ObjectStorageService();

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

router.post("/ai/analyze-photo", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }

    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit('ai', clientIp, 20, 60 * 1000)) {
      return res.status(429).json({ error: "Too many requests. Please try again in a minute." });
    }

    const { imageUrls, imageUrl, context } = req.body;
    
    const urls: string[] = imageUrls || (imageUrl ? [imageUrl] : []);
    
    if (urls.length === 0) {
      return res.status(400).json({ error: "At least one image URL is required" });
    }

    const resolvedUrls = urls.map((url: string) => {
      if (url.startsWith('/objects/')) {
        const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
        const host = req.headers['x-forwarded-host'] || req.headers.host;
        const resolved = `${protocol}://${host}${url}`;
        console.log(`[AI] Resolved relative image URL to: ${resolved}`);
        return resolved;
      }
      return url;
    });

    const userContent: ChatCompletionContentPart[] = [
      {
        type: "text",
        text: context 
          ? `Analyze ${resolvedUrls.length > 1 ? 'these roof inspection photos' : 'this roof inspection photo'}. Additional context: ${context}` 
          : `Analyze ${resolvedUrls.length > 1 ? 'these roof inspection photos together' : 'this roof inspection photo'} and provide your assessment.`
      }
    ];
    
    for (const url of resolvedUrls) {
      userContent.push({
        type: "image_url",
        image_url: { url }
      });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert roof inspector analyzing roof damage photos for RPrime Roofing Pty Ltd. 
${resolvedUrls.length > 1 ? 'You are being shown MULTIPLE photos of the SAME issue from different angles. Analyze them together to provide a comprehensive assessment.' : 'Analyze the image and provide a detailed assessment.'}

IMPORTANT: Use ONLY these exact category values:
- "Broken Tiles"
- "Ridge Capping"
- "Rust/Corrosion"
- "Gutters"
- "Flashing"
- "Leaks"
- "Downpipes"
- "Penetrations"
- "Skylights"
- "General Condition"
- "Safety"

Use ONLY these exact severity values (lowercase):
- "low"
- "medium"
- "high"
- "critical"

Respond in JSON format with these exact fields:
{
  "category": "one of the categories listed above",
  "severity": "low" | "medium" | "high" | "critical",
  "description": "string (2-3 sentences describing the issue${resolvedUrls.length > 1 ? ', synthesizing observations from all photos' : ''})",
  "recommendation": "string (2-3 sentences describing repair actions)"
}`
        },
        {
          role: "user",
          content: userContent
        }
      ],
      max_tokens: 1000,
      response_format: { type: "json_object" }
    });

    const analysis = JSON.parse(response.choices[0]?.message?.content || "{}");
    res.json(analysis);
  } catch (error) {
    console.error("Error analyzing photo:", error);
    res.status(500).json({ error: "Failed to analyze photo" });
  }
});

router.post("/ai/analyze-report", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }

    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit('ai', clientIp, 20, 60 * 1000)) {
      return res.status(429).json({ error: "Too many requests. Please try again in a minute." });
    }

    const { findings, estimateItems, roofType, roofPitch, reportStatus } = req.body;
    
    if (!findings || !Array.isArray(findings)) {
      return res.status(400).json({ error: "Findings array is required" });
    }

    const findingsContext = findings.map((f: Finding, i: number) => 
      `Finding ${i + 1}: [${f.category}] Severity: ${f.severity}\nDescription: ${f.description}\nRecommendation: ${f.recommendation}`
    ).join('\n\n');

    const estimatesContext = estimateItems?.length > 0 
      ? `\n\nEstimate Items:\n${estimateItems.map((e: EstimateItem) => `- ${e.description}: ${e.qty} x $${e.unitCost}`).join('\n')}`
      : '';

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert roof inspection report consultant for RPrime Roofing. Analyze this roof inspection report and provide actionable suggestions to improve its quality, completeness, and professionalism.

Focus on:
1. Content Quality: Are descriptions clear and professional? Any vague language that could be improved?
2. Missing Information: Based on the findings, are there related issues that should also be checked/documented?
3. Structure & Organization: Should findings be reordered by severity or grouped differently?
4. Estimates Alignment: Do the estimate items properly cover all the repair recommendations?
5. Professional Language: Suggest better phrasing for any findings that sound unprofessional.

Respond in JSON format:
{
  "overallScore": number (1-10),
  "summary": "Brief overall assessment (1-2 sentences)",
  "suggestions": [
    {
      "type": "content" | "missing" | "structure" | "estimate" | "language",
      "priority": "high" | "medium" | "low",
      "title": "Short title",
      "description": "Detailed suggestion",
      "findingIndex": number | null (if relates to specific finding, 0-indexed)
    }
  ],
  "quickWins": ["List of easy improvements that can be made immediately"]
}`
        },
        {
          role: "user",
          content: `Analyze this roof inspection report:

Roof Type: ${roofType || 'Not specified'}
Roof Pitch: ${roofPitch || 'Not specified'}
Report Status: ${reportStatus || 'Draft'}

FINDINGS:
${findingsContext || 'No findings recorded yet.'}
${estimatesContext}`
        }
      ],
      max_completion_tokens: 2000,
      response_format: { type: "json_object" }
    });

    const analysis = JSON.parse(response.choices[0]?.message?.content || "{}");
    res.json(analysis);
  } catch (error) {
    console.error("Error analyzing report:", error);
    res.status(500).json({ error: "Failed to analyze report" });
  }
});

router.post("/ai/summarize-report", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }

    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit('ai', clientIp, 20, 60 * 1000)) {
      return res.status(429).json({ error: "Too many requests. Please try again in a minute." });
    }

    const { findings, estimateItems, roofType, roofPitch, storeys, accessMethod, customerName, address, date, inspector } = req.body;

    if (!findings || !Array.isArray(findings) || findings.length === 0) {
      return res.status(400).json({ error: "Findings array is required and must not be empty" });
    }

    const findingsContext = findings.map((f: Finding, i: number) =>
      `Finding ${i + 1}: [${f.category}] Severity: ${f.severity}\nDescription: ${f.description}\nRecommendation: ${f.recommendation}`
    ).join('\n\n');

    const estimatesContext = estimateItems?.length > 0
      ? `\n\nEstimate Items:\n${estimateItems.map((e: EstimateItem) => `- ${e.description}: ${e.qty} x $${e.unitCost} = $${(e.qty * e.unitCost).toFixed(2)}`).join('\n')}`
      : '';

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert roof inspector writing a professional executive summary for an inspection report. Write a clear, concise summary suitable for presentation to a homeowner or property manager. The tone should be professional but accessible. Structure: 1) Overall condition assessment, 2) Key findings grouped by severity, 3) Recommended priority actions. Write in plain paragraphs (no bullet points or headings). Keep it to 2-3 paragraphs.`
        },
        {
          role: "user",
          content: `Write an executive summary for this roof inspection report:

Customer: ${customerName || 'Not specified'}
Property Address: ${address || 'Not specified'}
Inspection Date: ${date || 'Not specified'}
Inspector: ${inspector || 'Not specified'}
Roof Type: ${roofType || 'Not specified'}
Roof Pitch: ${roofPitch || 'Not specified'}
Storeys: ${storeys || 'Not specified'}
Access Method: ${accessMethod || 'Not specified'}

FINDINGS:
${findingsContext}
${estimatesContext}`
        }
      ],
      max_completion_tokens: 1500,
    });

    const summary = response.choices[0]?.message?.content || '';
    res.json({ summary });
  } catch (error) {
    console.error("Error generating report summary:", error);
    res.status(500).json({ error: "Failed to generate report summary" });
  }
});

router.post("/ai/extract-roofr-pdf", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit('ai', clientIp, 20, 60 * 1000)) {
      return res.status(429).json({ error: "Too many requests. Please try again in a minute." });
    }

    const { pdfUrl, filename } = req.body;
    
    if (!pdfUrl) {
      return res.status(400).json({ error: "PDF URL is required" });
    }

    console.log(`[AI] Processing PDF: ${pdfUrl}`);
    
    let pdfBuffer: Buffer;
    if (pdfUrl.startsWith('/objects/')) {
      const objectPath = pdfUrl.replace('/objects/', '');
      const privateDir = objectStorageService.getPrivateObjectDir();
      
      const pathParts = privateDir.split('/').filter((p: string) => p);
      const bucketName = pathParts[0];
      const privateDirPath = pathParts.slice(1).join('/');
      
      const objectName = `${privateDirPath}/${objectPath}`;
      
      console.log(`[AI] Fetching PDF from bucket: ${bucketName}, object: ${objectName}`);
      
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);
      const [contents] = await file.download();
      pdfBuffer = contents;
    } else {
      const pdfResponse = await fetch(pdfUrl);
      if (!pdfResponse.ok) {
        throw new Error(`Failed to download PDF: ${pdfResponse.status}`);
      }
      pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
    }

    const tempDir = '/tmp/pdf-convert';
    await fs.mkdir(tempDir, { recursive: true });
    const tempPdfPath = `${tempDir}/${randomUUID()}.pdf`;
    const tempOutputPrefix = `${tempDir}/${randomUUID()}`;
    await fs.writeFile(tempPdfPath, pdfBuffer);

    const { execSync } = await import('child_process');
    try {
      execSync(`pdftoppm -png -r 150 -l 3 "${tempPdfPath}" "${tempOutputPrefix}"`, {
        timeout: 30000,
      });
    } catch (convertError) {
      console.error('[AI] PDF conversion error:', convertError);
      throw new Error('Failed to convert PDF to images');
    }

    const files = await fs.readdir(tempDir);
    const imageFiles = files
      .filter((f: string) => f.startsWith(tempOutputPrefix.split('/').pop()!) && f.endsWith('.png'))
      .sort();
    
    if (imageFiles.length === 0) {
      throw new Error('No images generated from PDF');
    }

    console.log(`[AI] Converted PDF to ${imageFiles.length} images`);

    const imageContents: { type: "image_url"; image_url: { url: string } }[] = [];
    for (const imageFile of imageFiles.slice(0, 3)) {
      const imagePath = `${tempDir}/${imageFile}`;
      const imageBuffer = await fs.readFile(imagePath);
      const base64Image = imageBuffer.toString('base64');
      imageContents.push({
        type: "image_url",
        image_url: { url: `data:image/png;base64,${base64Image}` }
      });
    }

    try {
      await fs.unlink(tempPdfPath);
      for (const imageFile of imageFiles) {
        await fs.unlink(`${tempDir}/${imageFile}`);
      }
    } catch (cleanupError) {
      console.warn('[AI] Cleanup warning:', cleanupError);
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert at extracting roof measurement data from Roofr PDF reports. 
Extract all available measurements and property information from the provided PDF pages.

IMPORTANT: All measurements should be in METRIC units:
- Area measurements in square meters (m²)
- Linear measurements in meters (m)
- Pitch in degrees

If the PDF contains imperial units (feet, inches, squares), convert them:
- 1 roofing square = 9.29 m² (100 sq ft)
- 1 foot = 0.3048 m
- 1 inch = 0.0254 m

Return a JSON object with these fields (use null for any values not found):
{
  "propertyAddress": "Full address from the report",
  "totalRoofArea": number (m²),
  "pitchedRoofArea": number (m²) or null,
  "flatRoofArea": number (m²) or null,
  "predominantPitch": number (degrees) or null,
  "facetCount": number or null,
  "eaves": number (m) or null,
  "ridges": number (m) or null,
  "valleys": number (m) or null,
  "hips": number (m) or null,
  "rakes": number (m) or null,
  "wallFlashing": number (m) or null,
  "stepFlashing": number (m) or null,
  "parapetWall": number (m) or null,
  "transitions": number (m) or null,
  "roofingMaterial": "current material type" or null,
  "gutterLength": number (m) or null,
  "downpipeCount": number or null,
  "additionalNotes": "any other relevant observations"
}`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Please extract all roof measurements from this Roofr report. The file is: ${filename || 'roof_report.pdf'}. I'm providing ${imageContents.length} page(s) from the PDF.`
            },
            ...imageContents
          ]
        }
      ],
      max_completion_tokens: 2000,
      response_format: { type: "json_object" }
    });

    const extraction = JSON.parse(response.choices[0]?.message?.content || "{}");
    
    const stored = await storage.createRoofReportExtraction({
      organizationId,
      filename: filename || 'roofr_report.pdf',
      sourceUrl: pdfUrl,
      propertyAddress: extraction.propertyAddress || null,
      totalRoofArea: extraction.totalRoofArea || null,
      pitchedRoofArea: extraction.pitchedRoofArea || null,
      flatRoofArea: extraction.flatRoofArea || null,
      predominantPitch: extraction.predominantPitch || null,
      facetCount: extraction.facetCount || null,
      eaves: extraction.eaves || null,
      ridges: extraction.ridges || null,
      valleys: extraction.valleys || null,
      hips: extraction.hips || null,
      rakes: extraction.rakes || null,
      wallFlashing: extraction.wallFlashing || null,
      stepFlashing: extraction.stepFlashing || null,
      parapetWall: extraction.parapetWall || null,
      transitions: extraction.transitions || null,
      rawExtraction: extraction,
    });

    res.json({
      extraction: stored,
      rawData: extraction
    });
  } catch (error) {
    console.error("Error extracting Roofr PDF:", error);
    res.status(500).json({ error: "Failed to extract PDF data" });
  }
});

router.post("/ai/generate-quote-items", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit('ai', clientIp, 20, 60 * 1000)) {
      return res.status(429).json({ error: "Too many requests. Please try again in a minute." });
    }

    const { extractionId, templateId, useHistoricalContext = true } = req.body;
    
    if (!extractionId || !templateId) {
      return res.status(400).json({ error: "Extraction ID and Template ID are required" });
    }

    const extraction = await storage.getRoofReportExtraction(organizationId, extractionId);
    if (!extraction) {
      return res.status(404).json({ error: "Extraction not found" });
    }

    const template = await storage.getQuoteTemplate(organizationId, templateId);
    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }

    const mappings = await storage.getQuoteTemplateMappings(organizationId, templateId);
    if (mappings.length === 0) {
      return res.status(400).json({ error: "Template has no product mappings" });
    }

    const allItems = await storage.getAllItems(organizationId);
    
    let historicalContext: HistoricalContext | null = null;
    if (useHistoricalContext) {
      const importedPatterns = await storage.getAllMlPricingPatterns(organizationId);
      const itemPatterns: Record<string, { avgPrice: number, avgQty: number, count: number }> = {};
      
      for (const pattern of importedPatterns) {
        itemPatterns[pattern.normalizedKey] = {
          avgPrice: pattern.avgUnitPrice,
          avgQty: pattern.avgQuantity || 0,
          count: pattern.occurrenceCount,
        };
      }

      const recentQuotes = await storage.getRecentQuotesWithItems(organizationId, 20);
      for (const quote of recentQuotes) {
        for (const item of quote.items) {
          const key = (item.itemCode || item.description).toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
          if (!itemPatterns[key]) {
            itemPatterns[key] = { avgPrice: 0, avgQty: 0, count: 0 };
          }
          itemPatterns[key].avgPrice = (itemPatterns[key].avgPrice * itemPatterns[key].count + item.unitCost) / (itemPatterns[key].count + 1);
          itemPatterns[key].avgQty = (itemPatterns[key].avgQty * itemPatterns[key].count + item.qty) / (itemPatterns[key].count + 1);
          itemPatterns[key].count++;
        }
      }
      
      const totalPatterns = Object.keys(itemPatterns).length;
      if (totalPatterns > 0 || recentQuotes.length > 0) {
        historicalContext = {
          quotesAnalyzed: recentQuotes.length,
          importedPatterns: importedPatterns.length,
          avgQuoteTotal: recentQuotes.length > 0 ? recentQuotes.reduce((sum, q) => sum + q.total, 0) / recentQuotes.length : 0,
          avgItemCount: recentQuotes.length > 0 ? recentQuotes.reduce((sum, q) => sum + q.items.length, 0) / recentQuotes.length : 0,
          itemPatterns,
        };
      }
    }
    const itemsMap = new Map(allItems.map(item => [item.id, item]));

    const measurementMap: Record<string, keyof typeof extraction> = {
      'roof_area': 'totalRoofArea',
      'pitched_area': 'pitchedRoofArea',
      'flat_area': 'flatRoofArea',
      'ridges': 'ridges',
      'eaves': 'eaves',
      'valleys': 'valleys',
      'hips': 'hips',
      'rakes': 'rakes',
      'wall_flashing': 'wallFlashing',
      'step_flashing': 'stepFlashing',
      'parapet_wall': 'parapetWall',
    };

    const wastePercent = (template.wastePercent ?? 10) / 100;
    const laborMarkup = (template.laborMarkupPercent ?? 0) / 100;
    
    const generatedItems: GeneratedQuoteItem[] = [];

    for (const mapping of mappings) {
      if (mapping.isActive !== 'true') continue;

      const measurementField = measurementMap[mapping.measurementType];
      const measurementValue = measurementField ? (extraction[measurementField] as number | null) : null;
      
      if (measurementValue === null || measurementValue === undefined || measurementValue === 0) {
        continue;
      }

      let qty = 0;
      switch (mapping.calculationType) {
        case 'per_unit':
          qty = measurementValue;
          break;
        case 'per_coverage':
          const coverage = mapping.coveragePerUnit || 1;
          qty = Math.ceil(measurementValue / coverage);
          break;
        case 'fixed':
          qty = 1;
          break;
        case 'formula':
          const formula = mapping.customFormula;
          if (formula) {
            try {
              const sanitized = formula.replace(/measurement/g, String(measurementValue));
              if (/^[\d\s+\-*/().]+$/.test(sanitized)) {
                qty = safeEvaluateMath(sanitized);
                if (!isFinite(qty) || isNaN(qty) || qty < 0) qty = 0;
              } else {
                console.warn('Formula contains invalid characters, falling back to 1:1:', formula);
                qty = measurementValue;
              }
            } catch (e) {
              console.warn('Formula evaluation failed:', formula, e);
              qty = measurementValue;
            }
          } else {
            qty = measurementValue;
          }
          break;
      }

      if (mapping.applyWaste === 'true') {
        qty = Math.ceil(qty * (1 + wastePercent));
      }

      let description = mapping.productDescription || 'Line item';
      let unitCost = mapping.unitPrice || 0;
      let itemCode: string | null = null;
      let costPrice: number | null = null;
      let productId: string | null = null;

      if (mapping.productId) {
        const product = itemsMap.get(mapping.productId);
        if (product) {
          description = product.description;
          unitCost = product.sellPrice;
          itemCode = product.itemCode;
          costPrice = product.costPrice || null;
          productId = product.id;
          
          if (historicalContext?.itemPatterns && itemCode && unitCost > 0) {
            const normalizedKey = itemCode.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
            const pattern = historicalContext.itemPatterns[normalizedKey];
            if (pattern && pattern.count >= 5) {
              const historicalPrice = pattern.avgPrice;
              const blendedPrice = (unitCost * 0.85) + (historicalPrice * 0.15);
              unitCost = Math.round(blendedPrice * 100) / 100;
            }
          }
        }
      } else if (!unitCost && historicalContext?.itemPatterns) {
        const descKey = description.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
        const pattern = historicalContext.itemPatterns[descKey];
        if (pattern && pattern.avgPrice > 0) {
          unitCost = Math.round(pattern.avgPrice * 100) / 100;
        }
      }

      let laborCost = 0;
      if ((mapping.laborMinutesPerUnit ?? 0) > 0) {
        const laborHours = (mapping.laborMinutesPerUnit! * qty) / 60;
        laborCost = laborHours * (mapping.laborRate || 75) * (1 + laborMarkup);
      }

      const total = (qty * unitCost) + laborCost;

      generatedItems.push({
        id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        description,
        qty: Math.round(qty * 100) / 100,
        unitCost,
        total: Math.round(total * 100) / 100,
        itemCode,
        costPrice,
        productId,
        sortOrder: mapping.sortOrder ?? 0,
        measurementType: mapping.measurementType,
        measurementValue,
        laborCost: laborCost > 0 ? Math.round(laborCost * 100) / 100 : null,
        historicalPricing: historicalContext?.itemPatterns?.[itemCode || ''] || null,
      });
    }

    generatedItems.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

    res.json({
      items: generatedItems,
      template: { id: template.id, name: template.name },
      extraction: { id: extraction.id, address: extraction.propertyAddress },
      historicalContext: historicalContext ? {
        quotesAnalyzed: historicalContext.quotesAnalyzed,
        avgQuoteTotal: Math.round(historicalContext.avgQuoteTotal * 100) / 100,
        avgItemCount: Math.round(historicalContext.avgItemCount * 10) / 10,
        pricingAdjusted: Object.keys(historicalContext.itemPatterns || {}).length > 0,
      } : null,
      summary: {
        itemCount: generatedItems.length,
        subtotal: generatedItems.reduce((sum, item) => sum + item.total, 0),
        wastePercent: template.wastePercent,
        laborMarkup: template.laborMarkupPercent,
      }
    });
  } catch (error) {
    console.error("Error generating quote items:", error);
    res.status(500).json({ error: "Failed to generate quote items" });
  }
});

router.post("/ml/import-tradify-csv", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { csvContent, filename } = req.body;
    if (!csvContent) {
      return res.status(400).json({ error: "CSV content is required" });
    }

    const session = await storage.createMlImportSession({
      organizationId,
      filename: filename || 'tradify_export.csv',
      source: 'tradify',
      status: 'processing',
    });
    const lines = csvContent.split('\n');
    
    if (lines.length < 2) {
      await storage.updateMlImportSession(session.id, { 
        status: 'failed', 
        errorMessage: 'CSV file is empty or has no data rows' 
      });
      return res.status(400).json({ error: "CSV file is empty" });
    }

    const header = lines[0].split(',').map((h: string) => h.replace(/"/g, '').trim());
    const quoteNoIdx = header.indexOf('Quote No');
    const lineDescIdx = header.indexOf('Line Description');
    const lineQtyIdx = header.indexOf('Line Quantity');
    const lineUnitPriceIdx = header.indexOf('Line Unit Price');
    const lineAmountIdx = header.indexOf('Line Amount');
    const statusIdx = header.indexOf('Status');

    if (quoteNoIdx === -1 || lineDescIdx === -1 || statusIdx === -1) {
      await storage.updateMlImportSession(session.id, { 
        status: 'failed', 
        errorMessage: 'CSV missing required columns (Quote No, Line Description, Status)' 
      });
      return res.status(400).json({ error: "CSV missing required columns" });
    }

    await storage.clearMlPricingPatterns(organizationId, 'tradify');

    const processedQuotes = new Set<string>();
    let acceptedQuotes = 0;
    let totalLineItems = 0;
    const patternKeys = new Set<string>();

    const parseCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const normalizeKey = (desc: string): string => {
      return desc.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 100);
    };

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = parseCSVLine(line);
      const status = values[statusIdx]?.replace(/"/g, '').trim();

      const quoteNo = values[quoteNoIdx]?.replace(/"/g, '').trim();
      const description = values[lineDescIdx]?.replace(/"/g, '').trim();
      const quantity = parseFloat(values[lineQtyIdx]?.replace(/"/g, '') || '0');
      const unitPrice = parseFloat(values[lineUnitPriceIdx]?.replace(/"/g, '') || '0');
      const amount = parseFloat(values[lineAmountIdx]?.replace(/"/g, '') || '0');

      if (!description || quantity <= 0 || unitPrice <= 0) continue;

      if (!processedQuotes.has(quoteNo)) {
        processedQuotes.add(quoteNo);
        acceptedQuotes++;
      }

      totalLineItems++;
      const normalizedKey = normalizeKey(description);
      patternKeys.add(normalizedKey);

      await storage.upsertMlPricingPattern(organizationId, {
        itemDescription: description.substring(0, 255),
        normalizedKey,
        unitPrice,
        quantity,
        amount,
        source: 'tradify',
      });
    }

    await storage.updateMlImportSession(session.id, {
      status: 'completed',
      totalQuotes: processedQuotes.size,
      acceptedQuotes,
      totalLineItems,
      uniquePatterns: patternKeys.size,
    });

    res.json({
      success: true,
      session: {
        id: session.id,
        totalQuotes: processedQuotes.size,
        acceptedQuotes,
        totalLineItems,
        uniquePatterns: patternKeys.size,
      }
    });
  } catch (error) {
    console.error("Error importing Tradify CSV:", error);
    res.status(500).json({ error: "Failed to import CSV" });
  }
});

router.delete("/ml/clear-tradify-csv", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    await storage.clearMlPricingPatterns(organizationId, 'tradify');
    res.json({ success: true, message: "CSV pricing data cleared" });
  } catch (error) {
    console.error("Error clearing Tradify CSV data:", error);
    res.status(500).json({ error: "Failed to clear CSV data" });
  }
});

router.post("/ml/import-pdf-quote", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { pdfBase64, filename } = req.body;
    if (!pdfBase64 || !filename) {
      return res.status(400).json({ error: "Missing PDF data or filename" });
    }

    const session = await storage.createMlImportSession({
      organizationId,
      filename,
      source: 'pdf_quote',
      status: 'processing',
    });

    const openaiApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    const openaiBaseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || 'https://api.openai.com/v1';
    
    if (!openaiApiKey) {
      await storage.updateMlImportSession(session.id, { status: 'failed', errorMessage: 'OpenAI API not configured' });
      return res.status(500).json({ error: "AI service not configured" });
    }

    const existingProducts = await storage.getAllItems(organizationId);
    const productContext = existingProducts.slice(0, 50).map(p => `${p.itemCode}: ${p.description} ($${p.sellPrice})`).join('\n');

    let pdfText: string = '';
    let pdfBuffer: Buffer;
    
    try {
      let cleanBase64 = pdfBase64;
      if (pdfBase64.includes(',')) {
        cleanBase64 = pdfBase64.split(',')[1];
      }
      pdfBuffer = Buffer.from(cleanBase64, 'base64');
      console.log('[PDF] Buffer created, size:', pdfBuffer.length, 'bytes');
      
      if (pdfBuffer.length < 100) {
        throw new Error('PDF buffer too small');
      }
    } catch (bufferError: unknown) {
      console.error('[PDF] Buffer creation failed:', bufferError instanceof Error ? bufferError.message : bufferError);
      await storage.updateMlImportSession(session.id, { status: 'failed', errorMessage: 'Invalid PDF data' });
      return res.status(400).json({ error: "Invalid PDF data received" });
    }
    
    const errors: string[] = [];
    
    try {
      const { extractText } = await import('unpdf');
      const uint8Array = new Uint8Array(pdfBuffer.buffer, pdfBuffer.byteOffset, pdfBuffer.byteLength);
      const result = await extractText(uint8Array);
      pdfText = Array.isArray(result.text) ? result.text.join('\n') : (result.text || '');
      console.log('[PDF] Extracted with unpdf, length:', pdfText.length);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'unknown error';
      errors.push(`unpdf: ${errMsg}`);
      console.log('[PDF] unpdf failed:', errMsg);
    }
    
    if (!pdfText || pdfText.trim().length < 20) {
      try {
        const tempDir = '/tmp/pdf-parse';
        await fs.mkdir(tempDir, { recursive: true });
        const tempPdfPath = `${tempDir}/${randomUUID()}.pdf`;
        await fs.writeFile(tempPdfPath, pdfBuffer);
        
        const { createRequire } = await import('module');
        const require = createRequire(import.meta.url);
        const pdfParse = require('pdf-parse/lib/pdf-parse.js');
        const pdfDataBuffer = await fs.readFile(tempPdfPath);
        const data = await pdfParse(pdfDataBuffer);
        pdfText = data.text || '';
        console.log('[PDF] Extracted with pdf-parse, length:', pdfText.length);
        
        await fs.unlink(tempPdfPath).catch(() => {});
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'unknown error';
        errors.push(`pdf-parse: ${errMsg}`);
        console.log('[PDF] pdf-parse failed:', errMsg);
      }
    }
    
    if (!pdfText || pdfText.trim().length < 20) {
      const errorMsg = errors.length > 0 ? errors.join('; ') : 'No text extracted';
      console.error('[PDF] All parsers failed:', errorMsg);
      await storage.updateMlImportSession(session.id, { status: 'failed', errorMessage: errorMsg });
      return res.status(400).json({ error: "Failed to parse PDF file", details: errorMsg });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    
    let openaiResponse;
    try {
      openaiResponse = await fetch(`${openaiBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
          {
            role: 'system',
            content: `You are a roofing quote analyzer. Extract line items from the provided quote text.
            
For each line item, extract:
- description: The item/service description
- quantity: The quantity (number)
- unit: The unit of measurement (e.g., m, m², each, bundle, lm, job)
- unitPrice: Price per unit (number)
- total: Total price for this line (number)
- category: Category (materials, labour, equipment, sundries, other)

Also extract:
- quoteNumber: Quote reference number if visible
- customerName: Customer name if visible
- quoteDate: Date of quote if visible
- quoteTotal: Total quote amount

Existing products in catalog for reference:
${productContext}

Return JSON in this exact format:
{
  "quoteNumber": "string or null",
  "customerName": "string or null",
  "quoteDate": "string or null",
  "quoteTotal": number or null,
  "lineItems": [
    {
      "description": "string",
      "quantity": number,
      "unit": "string",
      "unitPrice": number,
      "total": number,
      "category": "string",
      "matchedProductCode": "string or null"
    }
  ]
}`
          },
          {
            role: 'user',
            content: `Extract all line items from this quote (filename: ${filename}):\n\n${pdfText.substring(0, 15000)}`
          }
        ],
          max_tokens: 4000,
          response_format: { type: 'json_object' }
        }),
      });
    } catch (fetchError: unknown) {
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error("OpenAI request timed out for PDF:", filename);
        await storage.updateMlImportSession(session.id, { status: 'failed', errorMessage: 'AI request timed out' });
        return res.status(504).json({ error: "AI processing timed out - try a smaller PDF" });
      }
      console.error("OpenAI fetch error:", fetchError);
      await storage.updateMlImportSession(session.id, { status: 'failed', errorMessage: 'AI connection failed' });
      return res.status(500).json({ error: "Failed to connect to AI service" });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error("OpenAI error:", errorText);
      await storage.updateMlImportSession(session.id, { status: 'failed', errorMessage: 'AI extraction failed' });
      return res.status(500).json({ error: "Failed to process PDF with AI" });
    }

    const aiResult = await openaiResponse.json();
    const content = aiResult.choices?.[0]?.message?.content;
    
    if (!content) {
      await storage.updateMlImportSession(session.id, { status: 'failed', errorMessage: 'No content from AI' });
      return res.status(500).json({ error: "AI returned empty response" });
    }

    let extractedData;
    try {
      extractedData = JSON.parse(content);
    } catch (e) {
      await storage.updateMlImportSession(session.id, { status: 'failed', errorMessage: 'Invalid AI response format' });
      return res.status(500).json({ error: "Failed to parse AI response" });
    }

    let patternsCreated = 0;
    const lineItems = extractedData.lineItems || [];
    
    const productLookup = new Map<string, typeof existingProducts[0]>();
    for (const product of existingProducts) {
      if (product.itemCode) {
        productLookup.set(product.itemCode.toLowerCase(), product);
      }
      const normalizedDesc = product.description.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 100);
      productLookup.set(normalizedDesc, product);
    }
    
    for (const item of lineItems) {
      if (!item.description || item.unitPrice === undefined) continue;
      
      const normalizedKey = item.description.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 100);
      
      let matchedProduct = productLookup.get(normalizedKey);
      
      if (!matchedProduct && item.itemCode) {
        matchedProduct = productLookup.get(item.itemCode.toLowerCase());
      }
      
      let markupPercentage: number | undefined;
      let costPrice: number | undefined;
      let itemCode: string | undefined;
      let unit: string | undefined;
      
      if (matchedProduct) {
        itemCode = matchedProduct.itemCode;
        costPrice = matchedProduct.costPrice;
        unit = matchedProduct.unit || item.unit;
        
        const sellPrice = Number(item.unitPrice) || 0;
        if (costPrice && costPrice > 0) {
          markupPercentage = ((sellPrice - costPrice) / costPrice) * 100;
        }
      }
      
      await storage.upsertMlPricingPattern(organizationId, {
        itemDescription: item.description,
        normalizedKey,
        unitPrice: Number(item.unitPrice) || 0,
        quantity: Number(item.quantity) || 1,
        amount: Number(item.total) || (Number(item.unitPrice) * (Number(item.quantity) || 1)),
        source: 'pdf_quote',
        itemCode,
        costPrice,
        markupPercentage,
        unit: unit || item.unit,
      });
      patternsCreated++;
    }

    await storage.updateMlImportSession(session.id, {
      status: 'completed',
      totalQuotes: 1,
      acceptedQuotes: 1,
      uniquePatterns: patternsCreated,
    });

    res.json({
      success: true,
      sessionId: session.id,
      patternsCreated,
      extractedData: {
        quoteNumber: extractedData.quoteNumber,
        customerName: extractedData.customerName,
        lineItemCount: lineItems.length,
      }
    });
  } catch (error) {
    console.error("Error importing PDF quote:", error);
    res.status(500).json({ error: "Failed to process PDF" });
  }
});

router.get("/ml/pricing-patterns", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const patterns = await storage.getAllMlPricingPatterns(organizationId);
    res.json(patterns);
  } catch (error) {
    console.error("Error fetching ML pricing patterns:", error);
    res.status(500).json({ error: "Failed to fetch patterns" });
  }
});

router.patch("/ml/pricing-patterns/:id", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;
    
    const { z } = await import("zod");
    const patchPricingPatternSchema = z.object({
      markupPercentage: z.number().nullable().optional(),
      itemCode: z.string().nullable().optional(),
      costPrice: z.number().nullable().optional(),
      unit: z.string().nullable().optional(),
      avgUnitPrice: z.number().optional(),
      productId: z.string().nullable().optional(),
    });
    
    const parseResult = patchPricingPatternSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Invalid request body", details: parseResult.error.issues });
    }
    
    const { itemCode, costPrice, markupPercentage, unit, avgUnitPrice, productId } = parseResult.data;

    const patterns = await storage.getAllMlPricingPatterns(organizationId);
    const pattern = patterns.find(p => p.id === id);
    if (!pattern) {
      return res.status(404).json({ error: "Pattern not found" });
    }

    const updated = await storage.updateMlPricingPattern(id, {
      itemCode,
      costPrice,
      markupPercentage,
      unit,
      avgUnitPrice,
      productId,
    });

    res.json(updated);
  } catch (error) {
    console.error("Error updating ML pricing pattern:", error);
    res.status(500).json({ error: "Failed to update pattern" });
  }
});

router.delete("/ml/pricing-patterns", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!await canUserDelete(req)) {
      return res.status(403).json({ error: "Permission denied" });
    }

    await storage.clearMlPricingPatterns(organizationId);
    res.json({ success: true });
  } catch (error) {
    console.error("Error clearing ML pricing patterns:", error);
    res.status(500).json({ error: "Failed to clear patterns" });
  }
});

router.get("/ml/import-sessions", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const sessions = await storage.getMlImportSessions(organizationId);
    res.json(sessions);
  } catch (error) {
    console.error("Error fetching ML import sessions:", error);
    res.status(500).json({ error: "Failed to fetch sessions" });
  }
});

router.post("/ml/generate-template", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { templateName = "AI Generated Template" } = req.body;

    const patterns = await storage.getAllMlPricingPatterns(organizationId);
    if (patterns.length === 0) {
      return res.status(400).json({ 
        error: "No pricing patterns found. Import a Tradify CSV first to teach the AI your pricing history." 
      });
    }

    const existingProducts = await storage.getAllItems(organizationId);
    const productCatalog = existingProducts
      .filter(p => p.isActive === 'true')
      .map(p => ({
        id: p.id,
        itemCode: p.itemCode,
        description: p.description,
        sellPrice: p.sellPrice,
        unit: p.unit,
        category: p.category,
      }));
    
    const patternSummary = patterns.map(p => ({
      description: p.itemDescription,
      avgPrice: p.avgUnitPrice.toFixed(2),
      avgQty: (p.avgQuantity || 1).toFixed(2),
      occurrences: p.occurrenceCount,
    }));

    const measurementTypes = [
      { value: 'roof_area', label: 'Total Roof Area', unit: 'm²', description: 'The total roof surface area - used for membrane, underlayment, insulation, sheets' },
      { value: 'pitched_area', label: 'Pitched Roof Area', unit: 'm²', description: 'Sloped/pitched roof sections - metal roofing, tiles, shingles' },
      { value: 'flat_area', label: 'Flat Roof Area', unit: 'm²', description: 'Flat roof sections - EPDM, TPO, waterproofing' },
      { value: 'ridges', label: 'Ridges', unit: 'm', description: 'Ridge line at roof peak - ridge caps, ridge vents' },
      { value: 'eaves', label: 'Eaves', unit: 'm', description: 'Lower roof edges - gutters, fascia, drip edge' },
      { value: 'valleys', label: 'Valleys', unit: 'm', description: 'Internal corners where roof planes meet - valley flashing' },
      { value: 'hips', label: 'Hips', unit: 'm', description: 'External corners where roof planes meet - hip caps' },
      { value: 'rakes', label: 'Rakes', unit: 'm', description: 'Sloped edges of gable roofs - rake trim, barge boards' },
      { value: 'wall_flashing', label: 'Wall Flashing', unit: 'm', description: 'Where roof meets walls - step flashing, apron flashing' },
      { value: 'step_flashing', label: 'Step Flashing', unit: 'm', description: 'Stepped flashing along walls and chimneys' },
      { value: 'parapet_wall', label: 'Parapet Wall', unit: 'm', description: 'Raised walls at roof edge - coping, counter flashing' },
      { value: 'fixed_job', label: 'Fixed Job Cost', unit: 'job', description: 'Fixed per-job costs - crane hire, scaffolding, EWP hire, solar panel removal, site cleanup, permits, Form43, trestles, equipment hire' },
    ];

    const productCatalogSection = productCatalog.length > 0 
      ? `\nEXISTING PRODUCT CATALOG (match to these when possible):
${JSON.stringify(productCatalog.slice(0, 200), null, 2)}

PRODUCT MATCHING INSTRUCTIONS:
- When a historical line item matches an existing product, include "productId" with the product's id
- Match based on similar descriptions, item codes, or categories
- If no match exists, omit productId and just use productDescription
- Use the product's sellPrice if it matches, otherwise use the historical avgPrice
`
      : '';

    const prompt = `You are a roofing industry expert. Analyze these line items from historical accepted quotes and categorize each one.

AVAILABLE CATEGORIES:
${measurementTypes.map(m => `- ${m.value}: ${m.label} (${m.unit}) - ${m.description}`).join('\n')}
${productCatalogSection}
HISTORICAL LINE ITEMS FROM ACCEPTED QUOTES:
${JSON.stringify(patternSummary, null, 2)}

For EACH line item, determine:
1. Which category it belongs to (use "fixed_job" for equipment hire, scaffolding, crane, permits, solar panel work, cleanup, etc.)
2. The calculation type: "per_unit" (1:1 with measurement), "per_coverage" (e.g., 1 item per X m²), "fixed" (fixed quantity per job), or "formula" (custom math expression using measurement variable)
3. For items per roof area/length, estimate coverage. For fixed job items, use calculationType="fixed" with coveragePerUnit=1
4. If a matching product exists in the catalog, include the "productId" field

IMPORTANT: Include ALL items - both measurement-based items AND fixed job costs. Fixed job items like crane hire, scaffolding, EWP, solar panel work, permits, trestles, etc. should use measurementType="fixed_job" and calculationType="fixed".

Example output format:
[
  {
    "measurementType": "roof_area",
    "productId": "abc123",
    "productDescription": "Colorbond Trimdek sheets supply & install",
    "calculationType": "per_unit",
    "coveragePerUnit": 1,
    "unitPrice": 70.00,
    "applyWaste": true
  },
  {
    "measurementType": "fixed_job",
    "productDescription": "Crane Hire",
    "calculationType": "fixed",
    "coveragePerUnit": 1,
    "unitPrice": 1000.00,
    "applyWaste": false
  },
  {
    "measurementType": "fixed_job",
    "productDescription": "Scaffolding and pole system",
    "calculationType": "fixed",
    "coveragePerUnit": 1,
    "unitPrice": 1500.00,
    "applyWaste": false
  }
]

Return ONLY valid JSON array, no other text.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 8000,
    });

    const content = response.choices[0]?.message?.content || "[]";
    
    let suggestedMappings: SuggestedMapping[];
    try {
      let cleaned = content
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      
      const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        cleaned = codeBlockMatch[1].trim();
      }
      
      if (!cleaned.endsWith(']')) {
        const lastCompleteObj = cleaned.lastIndexOf('}');
        if (lastCompleteObj > 0) {
          cleaned = cleaned.substring(0, lastCompleteObj + 1) + ']';
        }
      }
      
      suggestedMappings = JSON.parse(cleaned);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      return res.status(500).json({ error: "AI returned invalid response format" });
    }

    if (!Array.isArray(suggestedMappings) || suggestedMappings.length === 0) {
      return res.status(400).json({ 
        error: "AI could not generate any mappings from your pricing history. Try importing more quote data." 
      });
    }

    const allowedMeasurementTypes = ['roof_area', 'pitched_area', 'flat_area', 'ridges', 'eaves', 'valleys', 'hips', 'rakes', 'wall_flashing', 'step_flashing', 'parapet_wall', 'fixed_job'];
    const allowedCalculationTypes = ['per_unit', 'per_coverage', 'fixed', 'formula'];
    
    const validatedMappings = suggestedMappings.filter(m => {
      if (!m.measurementType || !allowedMeasurementTypes.includes(m.measurementType)) return false;
      if (!m.productDescription || typeof m.productDescription !== 'string') return false;
      if (m.calculationType && !allowedCalculationTypes.includes(m.calculationType)) return false;
      if (m.coveragePerUnit && (typeof m.coveragePerUnit !== 'number' || m.coveragePerUnit <= 0)) return false;
      return true;
    });

    if (validatedMappings.length === 0) {
      return res.status(400).json({ 
        error: "AI response contained no valid mappings. Try importing more quote data." 
      });
    }

    const template = await storage.createQuoteTemplate({
      organizationId,
      name: templateName,
      description: `Auto-generated from ${patterns.length} pricing patterns`,
      wastePercent: 10,
      laborMarkupPercent: 0,
      isDefault: 'false',
      isActive: 'true',
    });

    const validProductIds = new Set(existingProducts.map(p => p.id));
    
    const createdMappings: Awaited<ReturnType<typeof storage.createQuoteTemplateMapping>>[] = [];
    for (const mapping of validatedMappings) {
      try {
        const validatedProductId = mapping.productId && validProductIds.has(mapping.productId) 
          ? mapping.productId 
          : null;
        
        const created = await storage.createQuoteTemplateMapping(organizationId, {
          templateId: template.id,
          measurementType: mapping.measurementType,
          productId: validatedProductId,
          productDescription: mapping.productDescription.substring(0, 500),
          unitPrice: mapping.unitPrice || 0,
          calculationType: mapping.calculationType || 'per_unit',
          customFormula: mapping.customFormula || null,
          coveragePerUnit: Math.max(0.01, Math.min(1000, mapping.coveragePerUnit || 1)),
          applyWaste: mapping.applyWaste ? 'true' : 'false',
          laborMinutesPerUnit: 0,
          laborRate: 75,
          isActive: 'true',
        });
        createdMappings.push(created);
      } catch (mappingError) {
        console.error("Failed to create mapping:", mappingError);
      }
    }

    res.json({
      success: true,
      template,
      mappings: createdMappings,
      patternsAnalyzed: patterns.length,
      mappingsCreated: createdMappings.length,
    });
  } catch (error) {
    console.error("Error generating AI template:", error);
    res.status(500).json({ error: "Failed to generate template" });
  }
});

export default router;
