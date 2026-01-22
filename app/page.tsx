"use client";

import React, { useState, useCallback, useEffect } from "react";
import {
    Upload,
    Download,
    Image as ImageIcon,
    Settings2,
    Zap,
    Layers,
    SunMedium,
    MoveRight
} from "lucide-react";

// Types for our processing parameters
interface ProcessorParams {
    threshold: number;
    denoise: number;
    turdsize: number; // Despeckle area
    alphamax: number; // Smoothness
    optimize_tolerance: number;
    inverted: boolean;
    fill_holes: boolean;
    show_debug?: boolean;
}

interface Preset {
    name: string;
    description: string;
    params: ProcessorParams;
}

type PresetKey = 'clean' | 'photo' | 'laser' | 'custom';

const DEFAULT_PARAMS: ProcessorParams = {
    threshold: 128,
    denoise: 0,                    // No blur by default - clean graphics don't need it
    turdsize: 10,                  // Increased from 6 to 10 for better noise suppression
    alphamax: 1.0,                 // Potrace default (well-tested)
    optimize_tolerance: 0.2,       // Potrace default (well-tested)
    inverted: false,
    fill_holes: false,             // Disabled by default
};

export default function Home() {
    const [originalImage, setOriginalImage] = useState<string | null>(null);
    const [vectorSvg, setVectorSvg] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [params, setParams] = useState<ProcessorParams>(DEFAULT_PARAMS);
    const [presets, setPresets] = useState<Record<string, Preset>>({});
    const [selectedPreset, setSelectedPreset] = useState<PresetKey>('clean');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    // Load presets from API
    useEffect(() => {
        const loadPresets = async () => {
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7860';
                const response = await fetch(`${apiUrl}/presets`);
                if (response.ok) {
                    const data = await response.json();
                    setPresets(data);
                    // Apply clean preset by default
                    if (data.clean) {
                        setParams(data.clean.params);
                    }
                }
            } catch (error) {
                console.error("Failed to load presets:", error);
            }
        };
        loadPresets();
    }, []);

    // Helper to handle parameter changes
    const updateParam = (key: keyof ProcessorParams, value: number | boolean) => {
        setParams((prev) => ({ ...prev, [key]: value }));
        setSelectedPreset('custom'); // Switch to custom when user modifies
    };

    // Handle preset selection
    const handlePresetChange = (presetKey: PresetKey) => {
        setSelectedPreset(presetKey);
        if (presetKey !== 'custom' && presets[presetKey]) {
            setParams(presets[presetKey].params);
        }
    };

    // Helper to process file (common for click and drop)
    const processFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            if (event.target?.result) {
                setOriginalImage(event.target.result as string);
                setVectorSvg(null); // Reset previous result
            }
        };
        reader.readAsDataURL(file);
    };

    // Image Upload Handler (Click)
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            processFile(file);
        }
    };

    // Drag and Drop Handlers
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith('image/')) {
            processFile(file);
        }
    };

    // Helper to clean SVG for display
    const cleanSvgResponse = (svgText: string) => {
        // 1. Remove XML namespaces (ns0:) which break HTML rendering
        let clean = svgText.replace(/ns0:/g, "");
        clean = clean.replace(/xmlns:ns0="[^"]*"/g, "");

        // 2. Force White Fill: Replace black fill with white
        clean = clean.replace(/fill="#000000"/g, 'fill="#ffffff"');

        // 3. Remove metadata to avoid text artifacts
        clean = clean.replace(/<metadata>[\s\S]*?<\/metadata>/g, "");

        return clean;
    };

    // Real Vectorization Call
    const processImage = useCallback(async () => {
        if (!originalImage) return;

        setIsProcessing(true);

        try {
            // Convert DataURL to Blob
            const response = await fetch(originalImage);
            const blob = await response.blob();

            const formData = new FormData();
            formData.append('file', blob);
            // Append all params
            Object.entries(params).forEach(([key, value]) => {
                formData.append(key, value.toString());
            });

            // Call API
            const apiUrl = process.env.NEXT_PUBLIC_API_URL
                ? `${process.env.NEXT_PUBLIC_API_URL}/vectorize`
                : 'http://localhost:7860/vectorize'; // Fallback for local dev

            const apiResponse = await fetch(apiUrl, {
                method: 'POST',
                body: formData,
            });

            if (!apiResponse.ok) {
                const errText = await apiResponse.text();
                throw new Error(`Falló la vectorización (${apiResponse.status}): ${errText}`);
            }

            const rawSvg = await apiResponse.text();

            // Clean up the SVG for display
            const cleanSvg = cleanSvgResponse(rawSvg);

            setVectorSvg(cleanSvg);

        } catch (error) {
            console.error("Error processing image:", error);
            // alert("Error processing image: " + error);
        } finally {
            setIsProcessing(false);
        }

    }, [originalImage, params]);

    // Debounce processing to avoid spamming API on slider change (simple effect for now)
    useEffect(() => {
        const timer = setTimeout(() => {
            if (originalImage) {
                processImage();
            }
        }, 500); // 500ms debounce
        return () => clearTimeout(timer);
    }, [params, originalImage, processImage]);


    const handleDownload = () => {
        if (!vectorSvg) return;
        const blob = new Blob([vectorSvg], { type: "image/svg+xml" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "laservector-output.svg";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Preset Mappings with Icons
    const PRESET_ICONS: Record<PresetKey, React.ElementType> = {
        clean: Settings2, // Replaced Palette with Settings2 for Clean, or maybe Layers
        photo: ImageIcon,
        laser: Zap,
        custom: Settings2
    };

    // ... inside component ...

    // We need to match the backend keys to these local visual definitions
    // The backend sends 'clean', 'photo', 'laser'.

    return (
        <main className="flex flex-col h-screen overflow-hidden bg-zinc-950 text-zinc-300 font-sans">
            {/* Header */}
            <header className="h-16 border-b border-zinc-800 bg-zinc-900 flex items-center justify-between px-6 z-10">
                <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10 flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src="/logo.png"
                            alt="TMS Logo"
                            className="w-full h-full object-contain animate-[bounce_3s_infinite]"
                        />
                    </div>
                    <h1 className="text-xl font-black tracking-wider text-white uppercase" style={{ fontFamily: 'var(--font-inter)' }}>
                        Conversor <span className="text-teal-500">TMS</span>
                    </h1>
                </div>

                <div className="flex items-center gap-4">
                    {originalImage && (
                        <button
                            onClick={handleDownload}
                            disabled={!vectorSvg}
                            className="flex items-center gap-2 px-6 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-sm text-sm font-bold uppercase tracking-wide transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg"
                        >
                            <Download className="w-4 h-4" />
                            Descargar SVG
                        </button>
                    )}
                </div>
            </header>

            {/* Main Workspace */}
            <div className="flex-1 flex overflow-hidden">

                {/* Left Panel - Source */}
                <div className="flex-1 border-r border-zinc-800 bg-zinc-900 flex flex-col relative group">
                    <div className="absolute top-4 left-4 z-10 px-3 py-1 bg-zinc-950 border border-zinc-700 text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2 rounded-sm">
                        <ImageIcon className="w-3 h-3" /> Imagen de Origen
                    </div>

                    <div className="flex-1 flex items-center justify-center p-8 bg-zinc-900">
                        {!originalImage ? (
                            <label
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                className={`flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-sm transition-all duration-300 ease-in-out cursor-pointer group ${isDragging
                                    ? "border-teal-500 bg-teal-500/10 scale-105"
                                    : "border-zinc-700 hover:border-teal-500/50 hover:bg-zinc-800"
                                    }`}
                            >
                                <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                    <Upload className="w-8 h-8 text-zinc-500 group-hover:text-teal-400" />
                                </div>
                                <span className="text-zinc-300 font-bold uppercase tracking-wide">Arrastra o Click para subir</span>
                                <span className="text-zinc-500 text-xs mt-2 uppercase text-center">JPG, PNG, BMP</span>
                                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                            </label>
                        ) : (
                            <div className="relative w-full h-full flex items-center justify-center p-4">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={originalImage} alt="Source" className="max-w-[80%] max-h-[80%] object-contain shadow-2xl" />
                                <button
                                    onClick={() => { setOriginalImage(null); setVectorSvg(null); }}
                                    className="absolute top-2 right-2 p-2 bg-black/80 hover:bg-red-500 text-white rounded-sm transition-colors"
                                >
                                    ✕
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Center - Controls */}
                <div className="w-80 bg-zinc-950 border-l border-r border-zinc-800 flex flex-col z-20 shadow-xl">
                    <div className="p-4 border-b border-zinc-800 bg-zinc-900">
                        <h2 className="text-xs font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                            <Settings2 className="w-4 h-4" /> Configuración
                        </h2>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-zinc-950">

                        {/* Preset Selector */}
                        <div className="space-y-3">
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Perfil Predeterminado</label>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { key: 'clean' as PresetKey, label: 'Gráfico Limpio', icon: Layers },
                                    { key: 'photo' as PresetKey, label: 'Foto', icon: ImageIcon },
                                    { key: 'laser' as PresetKey, label: 'Láser CNC', icon: Zap },
                                    { key: 'custom' as PresetKey, label: 'Personalizado', icon: Settings2 }
                                ].map((preset) => (
                                    <button
                                        key={preset.key}
                                        onClick={() => handlePresetChange(preset.key)}
                                        className={`p-3 rounded-sm border-2 transition-all text-xs font-bold uppercase flex flex-col items-center gap-2 ${selectedPreset === preset.key
                                            ? 'border-teal-600 bg-teal-500/10 text-teal-500'
                                            : 'border-zinc-800 bg-zinc-900 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
                                            }`}
                                    >
                                        <preset.icon className="w-5 h-5" />
                                        <div className="leading-tight">{preset.label}</div>
                                    </button>
                                ))}
                            </div>
                            {selectedPreset !== 'custom' && presets[selectedPreset] && (
                                <p className="text-xs text-zinc-500 italic border-l-2 border-teal-500 pl-3 py-1">
                                    {presets[selectedPreset].description}
                                </p>
                            )}
                        </div>

                        {/* Advanced Controls Toggle */}
                        <div className="border-t border-zinc-800 pt-4">
                            <button
                                onClick={() => setShowAdvanced(!showAdvanced)}
                                className="w-full flex items-center justify-between text-sm font-bold uppercase text-zinc-400 hover:text-zinc-200 transition-colors"
                            >
                                <span>Controles Avanzados</span>
                                <span className={`transform transition-transform ${showAdvanced ? 'rotate-180' : ''}`}>▼</span>
                            </button>
                        </div>

                        {/* Advanced Controls - Collapsible */}
                        {showAdvanced && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-200">

                                {/* Threshold Section */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold uppercase text-zinc-400 flex items-center gap-2">
                                            <SunMedium className="w-4 h-4" /> Umbral
                                        </label>
                                        <span className="text-xs font-mono bg-zinc-900 border border-zinc-800 px-2 py-1 rounded-sm text-teal-500">{params.threshold}</span>
                                    </div>
                                    <input
                                        type="range" min="0" max="255" value={params.threshold}
                                        onChange={(e) => updateParam('threshold', parseInt(e.target.value))}
                                        className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-teal-500"
                                    />
                                    <p className="text-xs text-zinc-500">Ajusta la sensibilidad a la luz. Valores más bajos capturan más áreas oscuras.</p>
                                </div>

                                {/* Denoise Section */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold uppercase text-zinc-400 flex items-center gap-2">
                                            <Layers className="w-4 h-4" /> Reducción de Ruido
                                        </label>
                                        <span className="text-xs font-mono bg-zinc-900 border border-zinc-800 px-2 py-1 rounded-sm text-teal-500">{params.denoise}px</span>
                                    </div>
                                    <input
                                        type="range" min="0" max="10" step="1" value={params.denoise}
                                        onChange={(e) => updateParam('denoise', parseInt(e.target.value))}
                                        className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-teal-500"
                                    />
                                    <p className="text-xs text-zinc-500">Suaviza la imagen antes de vectorizar. Solo aumentar si la imagen tiene ruido o grano.</p>
                                </div>

                                {/* Debug Toggle */}
                                <div className="pt-4 border-t border-zinc-800">
                                    <button
                                        onClick={() => updateParam('show_debug', !params.show_debug)}
                                        className="text-xs text-teal-600 underline hover:text-teal-500"
                                    >
                                        {params.show_debug ? 'Ocultar Debug' : 'Ver Código SVG (Debug)'}
                                    </button>
                                </div>

                                {/* Potrace Params */}
                                <div className="space-y-4 pt-4 border-t border-zinc-800">
                                    <label className="text-xs font-black text-zinc-600 uppercase tracking-widest">Vector Settings</label>

                                    {/* Smoothness (Alphamax) */}
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold uppercase text-zinc-400">Suavizado</span>
                                            <span className="text-xs text-zinc-500">{params.alphamax.toFixed(1)}</span>
                                        </div>
                                        <input
                                            type="range" min="0" max="1.4" step="0.1" value={params.alphamax}
                                            onChange={(e) => updateParam('alphamax', parseFloat(e.target.value))}
                                            className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-teal-500"
                                        />
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold uppercase text-zinc-400">Supresión</span>
                                            <span className="text-xs text-zinc-500">{params.turdsize}px</span>
                                        </div>
                                        <input
                                            type="range" min="0" max="20" value={params.turdsize}
                                            onChange={(e) => updateParam('turdsize', parseInt(e.target.value))}
                                            className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-teal-500"
                                        />
                                    </div>
                                </div>

                                {/* Fill Holes Toggle */}
                                <div className="pt-4 border-t border-zinc-800">
                                    <label className="flex items-center justify-between cursor-pointer group">
                                        <span className="text-xs font-bold uppercase text-zinc-400 group-hover:text-zinc-200 transition-colors">Rellenar Huecos</span>
                                        <div
                                            onClick={() => updateParam('fill_holes', !params.fill_holes)}
                                            className={`w-10 h-5 rounded-full relative transition-colors ${params.fill_holes ? 'bg-teal-600' : 'bg-zinc-700'}`}
                                        >
                                            <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${params.fill_holes ? 'translate-x-5' : 'translate-x-0'}`} />
                                        </div>
                                    </label>
                                </div>

                                {/* Invert Toggle */}
                                <div className="pt-4 border-t border-zinc-800">
                                    <label className="flex items-center justify-between cursor-pointer group">
                                        <span className="text-xs font-bold uppercase text-zinc-400 group-hover:text-zinc-200 transition-colors">Invertir Resultado</span>
                                        <div
                                            onClick={() => updateParam('inverted', !params.inverted)}
                                            className={`w-10 h-5 rounded-full relative transition-colors ${params.inverted ? 'bg-teal-600' : 'bg-zinc-700'}`}
                                        >
                                            <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${params.inverted ? 'translate-x-5' : 'translate-x-0'}`} />
                                        </div>
                                    </label>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel - Result */}
                <div className="flex-1 bg-zinc-950 flex flex-col relative">
                    <div className="absolute top-4 right-4 z-10 px-3 py-1 bg-teal-900/20 border border-teal-500/30 rounded-sm text-xs font-bold uppercase tracking-wider text-teal-500 flex items-center gap-2">
                        <Zap className="w-3 h-3" /> Resultado Vectorial
                    </div>

                    <div className="flex-1 flex items-center justify-center p-8 bg-[url('/grid-dark.svg')] bg-[length:20px_20px]">
                        {isProcessing ? (
                            <div className="flex flex-col items-center gap-4">
                                <div className="w-12 h-12 border-4 border-zinc-800 border-t-teal-500 rounded-full animate-spin" />
                                <span className="text-teal-500 font-mono text-xs uppercase tracking-widest animate-pulse">Procesando...</span>
                            </div>
                        ) : params.show_debug && vectorSvg ? (
                            <div className="w-full h-full p-4 bg-zinc-900 overflow-auto border border-zinc-800 rounded-sm">
                                <pre className="text-xs text-green-500 font-mono whitespace-pre-wrap break-all">
                                    {vectorSvg}
                                </pre>
                            </div>
                        ) : vectorSvg ? (
                            <div className="relative flex items-center justify-center p-4 border border-zinc-800 bg-zinc-900 shadow-2xl max-w-[90%] max-h-[90%] overflow-hidden rounded-sm">
                                {/* Render SVG content safely */}
                                {/* Force fill with !fill-white and hide metadata */}
                                <div
                                    className="w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:max-h-[70vh] [&>svg]:object-contain [&_path]:!fill-white [&_g]:!fill-white [&_metadata]:hidden"
                                    dangerouslySetInnerHTML={{ __html: vectorSvg }}
                                />
                            </div>
                        ) : (
                            <div className="text-zinc-600 font-bold uppercase text-xs tracking-widest flex items-center gap-2 opacity-50">
                                <MoveRight className="w-4 h-4" /> Sube una imagen para comenzar
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </main >
    );
}
