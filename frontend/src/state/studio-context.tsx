import {
  createContext,
  useContext,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { ReconstructionResult, UploadedImage } from "@/types/reconstruction";
import type { BrushMaskState } from "@/utils/mask";

export type WorkingImage = { file: File; url: string };
export type StudioView = "paint" | "compare" | "side";

interface StudioState {
  originalImage: UploadedImage | null;
  setOriginalImage: Dispatch<SetStateAction<UploadedImage | null>>;
  workingImage: WorkingImage | null;
  setWorkingImage: Dispatch<SetStateAction<WorkingImage | null>>;
  passCount: number;
  setPassCount: Dispatch<SetStateAction<number>>;
  result: ReconstructionResult | null;
  setResult: Dispatch<SetStateAction<ReconstructionResult | null>>;
  view: StudioView;
  setView: Dispatch<SetStateAction<StudioView>>;
  brushPixelCount: number;
  setBrushPixelCount: Dispatch<SetStateAction<number>>;
  maskState: BrushMaskState | null;
  setMaskState: Dispatch<SetStateAction<BrushMaskState | null>>;
  activeRequestIdRef: MutableRefObject<number>;
}

const StudioContext = createContext<StudioState | null>(null);

export function StudioProvider({ children }: { children: ReactNode }) {
  const [originalImage, setOriginalImage] = useState<UploadedImage | null>(null);
  const [workingImage, setWorkingImage] = useState<WorkingImage | null>(null);
  const [passCount, setPassCount] = useState(0);
  const [result, setResult] = useState<ReconstructionResult | null>(null);
  const [view, setView] = useState<StudioView>("paint");
  const [brushPixelCount, setBrushPixelCount] = useState(0);
  const [maskState, setMaskState] = useState<BrushMaskState | null>(null);
  const activeRequestIdRef = useRef(0);

  return (
    <StudioContext.Provider
      value={{
        originalImage,
        setOriginalImage,
        workingImage,
        setWorkingImage,
        passCount,
        setPassCount,
        result,
        setResult,
        view,
        setView,
        brushPixelCount,
        setBrushPixelCount,
        maskState,
        setMaskState,
        activeRequestIdRef,
      }}
    >
      {children}
    </StudioContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStudio() {
  const state = useContext(StudioContext);
  if (!state) throw new Error("useStudio must be used within StudioProvider.");
  return state;
}
