import { CSSProperties, MouseEventHandler, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Dimensions = Record<'width' | 'height', string> & Record<'left' | 'right' | 'top' | 'bottom', number>;
// type Dimensions =  | 'width' | 'height', number>;

const INITIAL_DIMENSIONS: Dimensions = { width: '', height: '', left: 0, right: 0, top: 0, bottom: 0 };
const INITIAL_HANDLE = new Map<number, Plot>([[1, ['0%', '0%']]]);

const getElementBounds = <T extends HTMLElement>(node: T): Dimensions => {
    const bounds = node.getBoundingClientRect();
    return {
        left: bounds.left,
        right: bounds.right,
        top: bounds.top,
        bottom: bounds.bottom,
        width: `${bounds.width}`,
        height: `${bounds.height}`,
    };
};

type ClippingStateUnion = 'idle' | 'clipping' | 'complete';
type Plot = Readonly<[string, string]>;
type Handles = Map<number, Plot>;

const ClipActionButton = ({
    onClick,
    clippingState,
}: {
    clippingState: ClippingStateUnion;
    onClick: (clipValue: ClippingStateUnion) => void;
}) => {
    const handleClick = () => {
        const determineNewState =
            clippingState === 'idle' ? 'clipping' : clippingState === 'clipping' ? 'complete' : 'idle';
        if (determineNewState) {
            onClick(determineNewState);
        }
    };
    return (
        <button className='clippy-action-button' onClick={handleClick} data-clippy-ref='toggle'>
            {clippingState === 'clipping' ? 'Stop' : clippingState === 'complete' ? 'Restart' : 'Begin'} clipping
        </button>
    );
};

type ClipOverlayProps = {
    clippingState: ClippingStateUnion;
    dimensions: Dimensions;
    onCompleteClip: (values: string) => void;
};

const ClipOverlay = ({ dimensions, clippingState, onCompleteClip }: ClipOverlayProps) => {
    const [handlesData, setHandlesData] = useState<Handles>(INITIAL_HANDLE);
    const clipPath = useRef('');

    const handles = Array.from(handlesData, ([key, value]) => (
        <div
            className='clippy-handle'
            key={key}
            data-handle={key}
            style={{ left: `calc(${value[0]} - 10px)`, top: `calc(${value[1]} - 10px)` }}
        />
    ));

    useEffect(() => {
        if (clippingState === 'complete') {
            onCompleteClip(clipPath.current);
        }
    }, [clippingState]);

    const clipPathArray = Array.from(handlesData, ([_, coords]) => `${coords[0]} ${coords[1]}`);
    if (clipPathArray.length >= 3) {
        clipPathArray.push('0% 0%');
    }
    clipPath.current = clipPathArray.join(',');

    const createHandle = (e: MouseEvent): void => {
        const size = handlesData.size;
        const x = Math.min(Math.max(0, (e.clientX - dimensions.left) / Number(dimensions.width)), 1).toFixed(2);
        const y = Math.min(Math.max(0, (e.clientY - dimensions.top) / Number(dimensions.height)), 1).toFixed(2);
        setHandlesData((prev) => new Map([...prev, [size + 1, [`${x.slice(2)}%`, `${y.slice(2)}%`]]]));
    };

    const targetStyles = { width: `${dimensions.width}px`, height: `${dimensions.height}px` };

    return (
        <>
            <div
                className='clippy-overlay'
                data-clipping={clippingState}
                style={{ clipPath: `polygon(${clipPath.current})`, ...targetStyles }}
                data-clippy-ref='overlay'
            />
            {clippingState === 'clipping' && (
                <div onClick={createHandle} style={{ position: 'absolute', inset: '0', ...targetStyles }}>
                    {handles}
                </div>
            )}
        </>
    );
};

export function Clippy<T extends HTMLDivElement>({ children }: { children: ReactNode }) {
    const [targetDimensions, setTargetDimensions] = useState<Dimensions>(INITIAL_DIMENSIONS);
    const [clippingState, setClippingState] = useState<ClippingStateUnion>('idle');
    const [clipPathValues, setClipPathValues] = useState('');

    const callbackRef = useCallback((node: T | null) => {
        if (node) {
            const target = node.firstElementChild as HTMLElement;
            setTargetDimensions(getElementBounds(target));
            // maybe find a better way to do this with ':not([data-clippy-ref])'
            // if (target.length > 1) {
            //     throw new Error('You can only wrap a single element with Clippy!');
            // }
        }
    }, []);

    const handleOnClick = (value: ClippingStateUnion) => {
        if (value === 'idle' && clippingState === 'complete') {
            setClipPathValues('');
        }
        setClippingState(value);
    };

    const handleFinishClip = (values: string) => {
        setClipPathValues(values);
    };

    const { width, height } = targetDimensions;
    const targetStyles = { width: width ? `${width}px` : '100%', height: height ? `${height}px` : '100%' };

    return (
        <div ref={callbackRef} style={{ position: 'relative', ...targetStyles }}>
            {children}
            <ClipOverlay {...{ dimensions: targetDimensions, clippingState, onCompleteClip: handleFinishClip }} />
            <ClipActionButton onClick={handleOnClick} {...{ clippingState }} />
            <pre>clip-path: polygon({clipPathValues});</pre>
        </div>
    );
}
