import { useCallback, useMemo, useRef, useState } from "react";
import { ExcaliDrawService } from "../services/excalidrawService";
import { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

export function useExcaliDrawHook() {
    const apiRef = useRef<ExcalidrawImperativeAPI | null>(null)
    const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null)
    const service = useMemo(() => new ExcaliDrawService(apiRef), [])
    const bindApi = useCallback((excalidrawAPI: ExcalidrawImperativeAPI) => {
        apiRef.current = excalidrawAPI
        setApi(excalidrawAPI)
    }, [])

    return { bindApi, service, api }
}
