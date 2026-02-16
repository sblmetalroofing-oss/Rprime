import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';

const API_ENDPOINT = '/api/behavior/events';
const DEBOUNCE_MS = 1000;

type BehaviorEventType = 
  | 'rage_click' 
  | 'dead_click' 
  | 'slow_action' 
  | 'scroll_confusion' 
  | 'thrashing';

interface BehaviorEvent {
  sessionId: string;
  eventType: BehaviorEventType;
  pageUrl: string;
  elementSelector: string | null;
  timestamp: number;
  context: Record<string, any>;
}

function getElementSelector(element: Element | null): string | null {
  if (!element) return null;
  
  const parts: string[] = [];
  let current: Element | null = element;
  
  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();
    
    if (current.id) {
      selector = `#${current.id}`;
      parts.unshift(selector);
      break;
    }
    
    if (current.className && typeof current.className === 'string') {
      const classes = current.className.trim().split(/\s+/).slice(0, 2).join('.');
      if (classes) selector += `.${classes}`;
    }
    
    parts.unshift(selector);
    current = current.parentElement;
  }
  
  return parts.slice(-4).join(' > ');
}

function isInteractiveElement(element: Element): boolean {
  const tagName = element.tagName.toLowerCase();
  const interactiveTags = ['a', 'button', 'input', 'select', 'textarea', 'label'];
  
  if (interactiveTags.includes(tagName)) return true;
  if (element.hasAttribute('onclick')) return true;
  if (element.hasAttribute('href')) return true;
  if (element.getAttribute('role') === 'button') return true;
  if (element.getAttribute('tabindex') !== null) return true;
  if ((element as HTMLElement).contentEditable === 'true') return true;
  
  const style = window.getComputedStyle(element);
  if (style.cursor === 'pointer') return true;
  
  return false;
}

function getSessionId(): string {
  let sessionId = sessionStorage.getItem('behavior_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    sessionStorage.setItem('behavior_session_id', sessionId);
  }
  return sessionId;
}

export function useBehaviorTracking() {
  const { isAuthenticated } = useAuth();
  const [location] = useLocation();
  
  const sessionIdRef = useRef<string>('');
  const eventQueueRef = useRef<BehaviorEvent[]>([]);
  const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const clickHistoryRef = useRef<Map<string, number[]>>(new Map());
  const scrollDirectionsRef = useRef<{ direction: 'up' | 'down'; timestamp: number }[]>([]);
  const lastScrollYRef = useRef<number>(0);
  const routeHistoryRef = useRef<{ path: string; timestamp: number }[]>([]);
  const pendingActionsRef = useRef<Map<string, { startTime: number; element: Element }>>(new Map());

  const sendEvents = useCallback(async (events: BehaviorEvent[]) => {
    if (events.length === 0) return;
    
    try {
      await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ events }),
      });
    } catch (e) {
      console.debug('[BehaviorTracking] Failed to send events:', e);
    }
  }, []);

  const flushQueue = useCallback(() => {
    if (eventQueueRef.current.length > 0) {
      const events = [...eventQueueRef.current];
      eventQueueRef.current = [];
      sendEvents(events);
    }
  }, [sendEvents]);

  const queueEvent = useCallback((event: Omit<BehaviorEvent, 'sessionId' | 'timestamp' | 'pageUrl'>) => {
    if (!isAuthenticated) return;
    
    const fullEvent: BehaviorEvent = {
      ...event,
      sessionId: sessionIdRef.current,
      timestamp: Date.now(),
      pageUrl: window.location.href,
    };
    
    eventQueueRef.current.push(fullEvent);
    
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
    }
    flushTimeoutRef.current = setTimeout(flushQueue, DEBOUNCE_MS);
  }, [isAuthenticated, flushQueue]);

  useEffect(() => {
    if (!isAuthenticated) return;
    
    sessionIdRef.current = getSessionId();
    
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!target) return;
      
      const selector = getElementSelector(target) || 'unknown';
      const now = Date.now();
      
      const clicks = clickHistoryRef.current.get(selector) || [];
      const recentClicks = clicks.filter(t => now - t < 1000);
      recentClicks.push(now);
      clickHistoryRef.current.set(selector, recentClicks);
      
      if (recentClicks.length >= 3) {
        queueEvent({
          eventType: 'rage_click',
          elementSelector: selector,
          context: {
            clickCount: recentClicks.length,
            timeSpan: now - recentClicks[0],
            tagName: target.tagName.toLowerCase(),
          },
        });
        clickHistoryRef.current.set(selector, []);
      }
      
      if (!isInteractiveElement(target)) {
        let parent: Element | null = target.parentElement;
        let isChildOfInteractive = false;
        while (parent && parent !== document.body) {
          if (isInteractiveElement(parent)) {
            isChildOfInteractive = true;
            break;
          }
          parent = parent.parentElement;
        }
        
        if (!isChildOfInteractive) {
          queueEvent({
            eventType: 'dead_click',
            elementSelector: selector,
            context: {
              tagName: target.tagName.toLowerCase(),
              hasText: !!(target.textContent?.trim()),
              classList: Array.from(target.classList).slice(0, 3),
            },
          });
        }
      }
      
      const isActionElement = 
        target.tagName.toLowerCase() === 'button' ||
        (target.tagName.toLowerCase() === 'input' && 
          ['submit', 'button'].includes((target as HTMLInputElement).type)) ||
        target.closest('form button[type="submit"]');
      
      if (isActionElement) {
        // Skip slow action tracking for elements marked as expected slow (AI analysis, etc.)
        const isExpectedSlow = target.hasAttribute('data-expected-slow') || 
          target.closest('[data-expected-slow]') !== null;
        
        if (!isExpectedSlow) {
          const actionId = `${selector}_${now}`;
          pendingActionsRef.current.set(actionId, { startTime: now, element: target });
          
          setTimeout(() => {
            const pending = pendingActionsRef.current.get(actionId);
            if (pending) {
              const elapsed = Date.now() - pending.startTime;
              // Also skip if the element is now disabled (loading state)
              const isNowDisabled = (pending.element as HTMLButtonElement).disabled || 
                pending.element.getAttribute('aria-disabled') === 'true';
              
              if (elapsed >= 3000 && !isNowDisabled) {
                queueEvent({
                  eventType: 'slow_action',
                  elementSelector: selector,
                  context: {
                    duration: elapsed,
                    tagName: target.tagName.toLowerCase(),
                    actionType: 'click',
                  },
                });
              }
              pendingActionsRef.current.delete(actionId);
            }
          }, 3100);
        }
      }
    };
    
    const handleScroll = () => {
      const now = Date.now();
      const currentY = window.scrollY;
      const direction: 'up' | 'down' = currentY > lastScrollYRef.current ? 'down' : 'up';
      
      const history = scrollDirectionsRef.current;
      const lastEntry = history[history.length - 1];
      
      if (!lastEntry || lastEntry.direction !== direction) {
        history.push({ direction, timestamp: now });
      }
      
      const recentChanges = history.filter(h => now - h.timestamp < 2000);
      scrollDirectionsRef.current = recentChanges;
      
      if (recentChanges.length >= 4) {
        queueEvent({
          eventType: 'scroll_confusion',
          elementSelector: null,
          context: {
            directionChanges: recentChanges.length,
            timeSpan: now - recentChanges[0].timestamp,
            scrollPosition: currentY,
          },
        });
        scrollDirectionsRef.current = [];
      }
      
      lastScrollYRef.current = currentY;
    };
    
    let scrollTimeout: NodeJS.Timeout | null = null;
    const throttledScroll = () => {
      if (scrollTimeout) return;
      scrollTimeout = setTimeout(() => {
        handleScroll();
        scrollTimeout = null;
      }, 100);
    };
    
    document.addEventListener('click', handleClick, true);
    window.addEventListener('scroll', throttledScroll, { passive: true });
    
    return () => {
      document.removeEventListener('click', handleClick, true);
      window.removeEventListener('scroll', throttledScroll);
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current);
        flushQueue();
      }
      if (scrollTimeout) clearTimeout(scrollTimeout);
    };
  }, [isAuthenticated, queueEvent, flushQueue]);

  useEffect(() => {
    if (!isAuthenticated) return;
    
    const now = Date.now();
    routeHistoryRef.current.push({ path: location, timestamp: now });
    
    const recentRoutes = routeHistoryRef.current.filter(r => now - r.timestamp < 5000);
    routeHistoryRef.current = recentRoutes;
    
    if (recentRoutes.length >= 4) {
      queueEvent({
        eventType: 'thrashing',
        elementSelector: null,
        context: {
          routeCount: recentRoutes.length,
          routes: recentRoutes.map(r => r.path),
          timeSpan: now - recentRoutes[0].timestamp,
        },
      });
      routeHistoryRef.current = [{ path: location, timestamp: now }];
    }
  }, [location, isAuthenticated, queueEvent]);
}
