// ===== Файл: src/chart.tsx (НОВЫЙ, ДИСПЕТЧЕР) =====

import React from "react";
import { SingleFilterChart, ChartData, FilterOption } from "./SingleFilterChart";
import { MultiChannelChart, MultiChannelPlotData } from "./MultiChannelChart";

// Re-export for backwards compatibility
export type { ChartData as ChartContent, FilterOption };
export type { ChartData };

// Экспортируем палитру, чтобы она была доступна везде
export const CHANNEL_COLORS = [
 '#FF6384', '#36A2EB', '#FFEB57', '#4BC0C0',
'#9966FF', '#DB7006', '#A50045', '#1042A5',
'#F7464A', '#46BFBD', '#FDB45C', '#949FB1'

];

// Объединяем типы данных для удобства
export type PlotData = ChartData | MultiChannelPlotData;

// "Умная" проверка типа данных
function isMultiChannelData(data: PlotData): data is MultiChannelPlotData {
    return (data as MultiChannelPlotData).traces !== undefined;
}

export function Chart(props: {
    data: PlotData,
    onChange?: (item: string) => void // Делаем onChange необязательным
    selectedChannelIndex?: number,
    mutedChannels?: number[],
}) {
    // В зависимости от типа данных, рендерим нужный компонент
    if (isMultiChannelData(props.data)) {
        return <MultiChannelChart
            data={props.data}
            selectedChannelIndex={props.selectedChannelIndex}
            mutedChannels={props.mutedChannels}
        />;
    } else {
        // Убеждаемся, что onChange передан, т.к. он обязателен для SingleFilterChart
        if (!props.onChange) {
            console.error("onChange prop is required for SingleFilterChart");
            return null;
        }
        return <SingleFilterChart data={props.data} onChange={props.onChange} />;
    }
}
