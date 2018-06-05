type ResizeBehavior = "none" | "both" | "horizontal" | "vertical" | "n" | "b" | "h" | "v";
type OverflowBehavior = "hidden" | "scroll" | "visible-hidden" | "visible-scroll" | "h" | "s" | "v-h" | "v-s";
type VisibilityBehavior = "visible" | "hidden" | "auto" | "v" | "h" | "a";
type AutoHideBehavior = "never" | "scroll" | "leave" | "move" | "n" | "s" | "l" | "m";
type EventCallback = (this: OverlayScrollbarsClass) => void;

interface OverlayScrollbarsOptions {
    className?: string | null,
    resize?: ResizeBehavior,
    sizeAutoCapable?: boolean,
    clipAlways?: boolean,
    normalizeRTL?: boolean,
    paddingAbsolute?: boolean,
    autoUpdate?: boolean | null,
    autoUpdateInterval?: number,
    nativeScrollbarsOverlaid?: {
        showNativeScrollbars?: boolean,
        initialize?: boolean
    },
    overflowBehavior?: {
        x?: OverflowBehavior,
        y?: OverflowBehavior
    },
    scrollbars?: {
        visibility?: VisibilityBehavior,
        autoHide?: AutoHideBehavior,
        autoHideDelay?: number,
        dragScrolling?: boolean,
        clickScrolling?: boolean,
        touchSupport?: boolean
    },
    textarea?: {
        dynWidth?: boolean,
        dynHeight?: boolean
    },
    callbacks?: {
        onInitialized?: EventCallback | null,
        onInitializationWithdrawn?: EventCallback | null,
        onDestroyed?: EventCallback | null,
        onScrollStart?: EventCallback | null,
        onScroll?: EventCallback | null,
        onScrollStop?: EventCallback | null,
        onOverflowChanged?: EventCallback | null,
        onOverflowAmountChanged?: EventCallback | null,
        onDirectionChanged?: EventCallback | null,
        onContentSizeChanged?: EventCallback | null,
        onHostSizeChanged?: EventCallback | null,
        onUpdated?: EventCallback | null
    }
}

interface ScrollInfo {
    x: {
        position: number,
        ratio: number,
        max: number,
        handleOffset: number,
        handleLength: number,
        handleLengthRatio: number,
        trackLength: number,
        isRTL: boolean
        isRTLNormalized: boolean
    },
    y: {
        position: number,
        ratio: number,
        max: number,
        handleOffset: number,
        handleLength: number,
        handleLengthRatio: number,
        trackLength: number
    }
}

interface Elements {
    target: HTMLElement,
    host: HTMLElement,
    padding: HTMLElement,
    viewport: HTMLElement,
    content: HTMLElement,
    scrollbarHorizontal: {
        scrollbar: HTMLElement,
        track: HTMLElement,
        handle: HTMLElement
    },
    scrollbarVertical: {
        scrollbar: HTMLElement,
        track: HTMLElement,
        handle: HTMLElement
    },
    scrollbarCorner: HTMLElement
}

interface State {
    sleeping: boolean,
    autoUpdate: boolean,
    widthAuto: boolean,
    heightAuto: boolean,
    documentMixed: boolean,
    padding: {
        t: number,
        r: number,
        b: number,
        l: number
    },
    overflowAmount: {
        x: number,
        y: number
    },
    hideOverflow: {
        x: boolean,
        y: boolean,
        xs: boolean,
        ys: boolean
    },
    hasOverflow: {
        x: boolean,
        y: boolean
    },
    contentScrollSize: {
        width: number,
        height: number
    },
    viewportSize: {
        width: number,
        height: number
    },
    hostSize: {
        width: number,
        height: number
    }
}

type _Position = number | string;

type _Coordinates =
    { x: _Position, y: _Position } |
    { l: _Position, t: _Position } |
    { left: _Position, top: _Position } |
    [_Position, _Position] |
    _Position |
    HTMLElement |
    {
        el: HTMLElement,
        axis: string,
        block: string | ReadonlyArray<string>,
        margin: number | ReadonlyArray<number> | boolean
    };

interface OverlayScrollbarsClass {
    options(): OverlayScrollbarsOptions;
    options<T = {} | undefined | null>(optionName: string): T;
    options(optionName: string, optionValue: any);
    options(options: OverlayScrollbarsOptions);

    update(force?: boolean);
    sleep();
    scroll(): ScrollInfo;
    scroll(coordinates: _Coordinates, duration?: number, easing?: string | ReadonlyArray<string>, complete?: Function);
    scroll(coordinates: _Coordinates, options?: object);
    scrollStop();
    getElements(): Elements;
    getState(): State;
    getState<T = {} | undefined | null>(stateProperty): T;
    destroy();
}

declare interface OverlayScrollbarsStatic {
    (element: HTMLElement, options: OverlayScrollbarsOptions): OverlayScrollbarsClass;
    (element: HTMLElement): OverlayScrollbarsClass | undefined;

    (elements: NodeListOf<Element> | ReadonlyArray<Element>, options: OverlayScrollbarsOptions): Array<OverlayScrollbarsClass>;
    (elements: NodeListOf<Element> | ReadonlyArray<Element>): Array<OverlayScrollbarsClass>;

    globals(): {
        defaultOptions: {},
        autoUpdateLoop: boolean,
        autoUpdateRecommended: boolean,
        supportMutationObserver: boolean,
        supportResizeObserver: boolean,
        supportPassiveEvents: boolean,
        supportTransform: boolean,
        supportTransition: boolean,
        restrictedMeasuring: boolean,
        nativeScrollbarStyling: boolean,
        cssCalc: string,
        nativeScrollbarSize: {
            x: number,
            y: number
        },
        nativeScrollbarIsOverlaid: {
            x: boolean,
            y: boolean
        },
        overlayScrollbarDummySize: {
            x: number,
            y: number
        },
        rtlScrollBehavior: {
            i: boolean,
            n: boolean
        }
    };

    defaultOptions(): OverlayScrollbarsOptions;
    defaultOptions(newDefaultOptions: OverlayScrollbarsOptions): OverlayScrollbarsOptions;
}

declare var OverlayScrollbars: OverlayScrollbarsStatic;