import * as React from "react"

const MOBILE_BREAKPOINT = 1024
const PHONE_MAX_HEIGHT = 500

export type DeviceSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

export interface DeviceInfo {
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  isIOS: boolean
  isAndroid: boolean
  isWindows: boolean
  isMac: boolean
  deviceSize: DeviceSize
  screenWidth: number
  screenHeight: number
  hasNotch: boolean
  isLandscape: boolean
  isPWA: boolean
  isTouch: boolean
  prefersReducedMotion: boolean
  connectionType: 'fast' | 'slow' | 'offline' | 'unknown'
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const checkMobile = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
      
      const isMobileDevice = width < MOBILE_BREAKPOINT || (isTouch && height < PHONE_MAX_HEIGHT)
      setIsMobile(isMobileDevice)
    }
    
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    mql.addEventListener("change", checkMobile)
    window.addEventListener("resize", checkMobile)
    checkMobile()
    
    return () => {
      mql.removeEventListener("change", checkMobile)
      window.removeEventListener("resize", checkMobile)
    }
  }, [])

  return !!isMobile
}

export function useDeviceInfo(): DeviceInfo {
  const [deviceInfo, setDeviceInfo] = React.useState<DeviceInfo>({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isIOS: false,
    isAndroid: false,
    isWindows: false,
    isMac: false,
    deviceSize: 'lg',
    screenWidth: typeof window !== 'undefined' ? window.innerWidth : 1024,
    screenHeight: typeof window !== 'undefined' ? window.innerHeight : 768,
    hasNotch: false,
    isLandscape: false,
    isPWA: false,
    isTouch: false,
    prefersReducedMotion: false,
    connectionType: 'unknown',
  })

  React.useEffect(() => {
    const checkDevice = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      const ua = navigator.userAgent
      
      const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
      const isAndroid = /Android/.test(ua)
      const isWindows = /Windows/.test(ua)
      const isMac = /Macintosh/.test(ua) && !isIOS
      const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
      
      const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
        document.referrer.includes('android-app://')
      
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      
      let connectionType: 'fast' | 'slow' | 'offline' | 'unknown' = 'unknown'
      if (!navigator.onLine) {
        connectionType = 'offline'
      } else if ('connection' in navigator) {
        const conn = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection
        if (conn) {
          const effectiveType = conn.effectiveType
          if (effectiveType === '4g') connectionType = 'fast'
          else if (effectiveType === '3g' || effectiveType === '2g' || effectiveType === 'slow-2g') connectionType = 'slow'
        }
      }
      
      let deviceSize: DeviceSize = 'lg'
      if (width < 375) deviceSize = 'xs'
      else if (width < 414) deviceSize = 'sm'
      else if (width < 768) deviceSize = 'md'
      else if (width < 1024) deviceSize = 'lg'
      else deviceSize = 'xl'
      
      // isMobile is true for anything under 1024px (phones + iPads) - they all use bottom nav
      const isMobile = width < MOBILE_BREAKPOINT || (isTouch && height < PHONE_MAX_HEIGHT)
      // isTablet preserved for any tablet-specific UI (not navigation)
      const isTablet = width >= 768 && width < 1024 && isTouch
      const isDesktop = width >= MOBILE_BREAKPOINT && !isMobile
      
      const hasNotch = isIOS && (
        (width === 375 && height === 812) ||
        (width === 390 && height === 844) ||
        (width === 393 && height === 852) ||
        (width === 402 && height === 874) ||
        (width === 414 && height === 896) ||
        (width === 428 && height === 926) ||
        (width === 430 && height === 932) ||
        (width === 440 && height === 956) ||
        CSS.supports('padding-top: env(safe-area-inset-top)')
      )
      
      setDeviceInfo({
        isMobile,
        isTablet,
        isDesktop,
        isIOS,
        isAndroid,
        isWindows,
        isMac,
        deviceSize,
        screenWidth: width,
        screenHeight: height,
        hasNotch,
        isLandscape: width > height,
        isPWA,
        isTouch,
        prefersReducedMotion,
        connectionType,
      })
    }
    
    window.addEventListener("resize", checkDevice)
    window.addEventListener("orientationchange", checkDevice)
    window.addEventListener("online", checkDevice)
    window.addEventListener("offline", checkDevice)
    checkDevice()
    
    return () => {
      window.removeEventListener("resize", checkDevice)
      window.removeEventListener("orientationchange", checkDevice)
      window.removeEventListener("online", checkDevice)
      window.removeEventListener("offline", checkDevice)
    }
  }, [])

  return deviceInfo
}

const DeviceContext = React.createContext<DeviceInfo | null>(null)

export function DeviceProvider({ children }: { children: React.ReactNode }) {
  const deviceInfo = useDeviceInfo()
  return (
    <DeviceContext.Provider value={deviceInfo}>
      {children}
    </DeviceContext.Provider>
  )
}

export function useDevice(): DeviceInfo {
  const context = React.useContext(DeviceContext)
  const fallback = useDeviceInfo()
  return context ?? fallback
}
