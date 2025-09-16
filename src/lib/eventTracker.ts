/**
 * Event Tracking Module
 * Records user interactions (mouse, keyboard) and HTML elements for research
 */

export interface UserEvent {
  timestamp: number
  type: 'click' | 'mousemove' | 'keydown' | 'keyup' | 'scroll' | 'focus' | 'blur'
  x?: number
  y?: number
  key?: string
  element: {
    tagName: string
    id?: string
    className?: string
    textContent?: string
    xpath: string
    attributes?: Record<string, string>
  }
  pageUrl: string
  viewportWidth: number
  viewportHeight: number
}

// Frontend-compatible event format (matches TimelineEvent)
export interface TimelineEvent {
  id: string
  timestamp: number
  duration?: number
  label: string
  category?: string
  data?: any
}

export class EventTracker {
  private isTracking = false
  private eventBuffer: UserEvent[] = []
  private recordingStartTime: number | null = null

  constructor(private onEventCapture?: (event: UserEvent) => void) {}

  startTracking(recordingStartTime: number) {
    if (this.isTracking) return

    this.isTracking = true
    this.recordingStartTime = recordingStartTime
    this.eventBuffer = []

    console.log('🎯 Event tracking started')

    // Add event listeners
    this.addEventListeners()
  }

  stopTracking() {
    if (!this.isTracking) return

    this.isTracking = false
    this.removeEventListeners()

    console.log('🛑 Event tracking stopped, captured', this.eventBuffer.length, 'events')
    return this.eventBuffer
  }

  getEvents(): UserEvent[] {
    return [...this.eventBuffer]
  }

  clearEvents() {
    this.eventBuffer = []
  }

  // Convert to frontend-compatible format
  getTimelineEvents(): TimelineEvent[] {
    return this.eventBuffer.map((event, index) => ({
      id: `event-${index}-${Date.now()}`,
      timestamp: event.timestamp,
      duration: event.type === 'click' ? 100 : undefined, // Clicks have brief duration
      label: this.createEventLabel(event),
      category: this.getEventCategory(event.type),
      data: {
        ...event,
        // Flatten for easier access
        elementTag: event.element.tagName,
        elementId: event.element.id,
        elementClass: event.element.className,
        elementText: event.element.textContent,
        elementXPath: event.element.xpath
      }
    }));
  }

  private createEventLabel(event: UserEvent): string {
    const element = event.element;

    switch (event.type) {
      case 'click':
        return `Click ${element.tagName}${element.id ? `#${element.id}` : ''}${element.textContent ? ` "${element.textContent.substring(0, 20)}..."` : ''}`;
      case 'keydown':
      case 'keyup':
        return `Key ${event.type === 'keydown' ? 'Press' : 'Release'}: ${event.key}`;
      case 'focus':
        return `Focus ${element.tagName}${element.id ? `#${element.id}` : ''}`;
      case 'blur':
        return `Blur ${element.tagName}${element.id ? `#${element.id}` : ''}`;
      case 'scroll':
        return 'Scroll';
      case 'mousemove':
        return `Mouse (${event.x}, ${event.y})`;
      default:
        return `${event.type} ${element.tagName}`;
    }
  }

  private getEventCategory(type: UserEvent['type']): string {
    switch (type) {
      case 'click':
        return 'interaction';
      case 'keydown':
      case 'keyup':
        return 'keyboard';
      case 'mousemove':
        return 'mouse';
      case 'scroll':
        return 'navigation';
      case 'focus':
      case 'blur':
        return 'focus';
      default:
        return 'other';
    }
  }

  private addEventListeners() {
    // Mouse events
    document.addEventListener('click', this.handleMouseClick, true)
    document.addEventListener('mousemove', this.handleMouseMove, true)

    // Keyboard events
    document.addEventListener('keydown', this.handleKeyDown, true)
    document.addEventListener('keyup', this.handleKeyUp, true)

    // Scroll events
    document.addEventListener('scroll', this.handleScroll, true)

    // Focus events
    document.addEventListener('focus', this.handleFocus, true)
    document.addEventListener('blur', this.handleBlur, true)
  }

  private removeEventListeners() {
    document.removeEventListener('click', this.handleMouseClick, true)
    document.removeEventListener('mousemove', this.handleMouseMove, true)
    document.removeEventListener('keydown', this.handleKeyDown, true)
    document.removeEventListener('keyup', this.handleKeyUp, true)
    document.removeEventListener('scroll', this.handleScroll, true)
    document.removeEventListener('focus', this.handleFocus, true)
    document.removeEventListener('blur', this.handleBlur, true)
  }

  private handleMouseClick = (e: MouseEvent) => {
    this.captureEvent('click', e, e.target as Element)
  }

  private handleMouseMove = (e: MouseEvent) => {
    // Throttle mouse move events (capture every 100ms max)
    if (!this.shouldCaptureMouseMove()) return
    this.captureEvent('mousemove', e, e.target as Element)
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    this.captureEvent('keydown', e, e.target as Element)
  }

  private handleKeyUp = (e: KeyboardEvent) => {
    this.captureEvent('keyup', e, e.target as Element)
  }

  private handleScroll = (e: Event) => {
    this.captureEvent('scroll', e, document.documentElement)
  }

  private handleFocus = (e: FocusEvent) => {
    this.captureEvent('focus', e, e.target as Element)
  }

  private handleBlur = (e: FocusEvent) => {
    this.captureEvent('blur', e, e.target as Element)
  }

  private lastMouseMoveTime = 0
  private shouldCaptureMouseMove(): boolean {
    const now = Date.now()
    if (now - this.lastMouseMoveTime > 100) { // 100ms throttle
      this.lastMouseMoveTime = now
      return true
    }
    return false
  }

  private captureEvent(
    type: UserEvent['type'],
    event: Event,
    element: Element | null
  ) {
    if (!this.isTracking || !element || !this.recordingStartTime) return

    // Skip our own overlay elements
    if (this.isInternalElement(element)) return

    const userEvent: UserEvent = {
      timestamp: Date.now() - this.recordingStartTime,
      type,
      pageUrl: window.location.href,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      element: this.getElementInfo(element)
    }

    // Add position for mouse events
    if (event instanceof MouseEvent) {
      userEvent.x = event.clientX
      userEvent.y = event.clientY
    }

    // Add key for keyboard events
    if (event instanceof KeyboardEvent) {
      userEvent.key = event.key
    }

    this.eventBuffer.push(userEvent)

    // Call callback if provided
    if (this.onEventCapture) {
      this.onEventCapture(userEvent)
    }

    // Log occasionally for debugging
    if (Math.random() < 0.001) { // 0.1% of events
      console.log('📝 Event captured:', type, userEvent.element.tagName)
    }
  }

  private isInternalElement(element: Element): boolean {
    // Skip Cogix overlay elements
    if (element.id?.startsWith('cogix-') ||
        element.className?.includes('cogix-') ||
        element.closest('#cogix-overlay-container') ||
        element.closest('#cogix-gaze-point') ||
        element.closest('#cogix-gaze-raw')) {
      return true
    }

    // Skip browser extension elements
    if (element.closest('[data-extension]') ||
        element.closest('[id*="extension"]')) {
      return true
    }

    return false
  }

  private getElementInfo(element: Element): UserEvent['element'] {
    const info: UserEvent['element'] = {
      tagName: element.tagName.toLowerCase(),
      xpath: this.getXPath(element)
    }

    // Add ID if present
    if (element.id) {
      info.id = element.id
    }

    // Add class name if present
    if (element.className && typeof element.className === 'string') {
      info.className = element.className
    }

    // Add text content (truncated for performance)
    const textContent = element.textContent?.trim()
    if (textContent && textContent.length > 0) {
      info.textContent = textContent.length > 100
        ? textContent.substring(0, 100) + '...'
        : textContent
    }

    // Add important attributes
    const importantAttrs = ['type', 'name', 'value', 'href', 'src', 'alt', 'title', 'role', 'data-testid']
    const attributes: Record<string, string> = {}

    for (const attr of importantAttrs) {
      const value = element.getAttribute(attr)
      if (value) {
        attributes[attr] = value
      }
    }

    if (Object.keys(attributes).length > 0) {
      info.attributes = attributes
    }

    return info
  }

  private getXPath(element: Element): string {
    if (element.id) {
      return `//*[@id="${element.id}"]`
    }

    const parts: string[] = []
    let current: Element | null = element

    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let index = 1
      let sibling = current.previousElementSibling

      while (sibling) {
        if (sibling.tagName === current.tagName) {
          index++
        }
        sibling = sibling.previousElementSibling
      }

      const tagName = current.tagName.toLowerCase()
      const part = index > 1 ? `${tagName}[${index}]` : tagName
      parts.unshift(part)

      current = current.parentElement
    }

    return '/' + parts.join('/')
  }
}

// Global instance
export const eventTracker = new EventTracker()