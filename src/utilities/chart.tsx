// ===== File: src/chart.tsx (NEW, DISPATCHER) =====

import React from "react"
import { SingleFilterChart, ChartData, FilterOption } from "./SingleFilterChart"
import { MultiChannelChart, MultiChannelPlotData } from "./MultiChannelChart"

// Re-export for backwards compatibility
export type { ChartData as ChartContent, FilterOption }
export type { ChartData }

// Export palette to be accessible everywhere
export const CHANNEL_COLORS = [
  "#FF6384",
  "#36A2EB",
  "#FFEB57",
  "#4BC0C0",
  "#9966FF",
  "#DB7006",
  "#A50045",
  "#1042A5",
  "#F7464A",
  "#46BFBD",
  "#FDB45C",
  "#949FB1",
]

// Combine data types for convenience
export type PlotData = ChartData | MultiChannelPlotData

// "Smart" data type check
function isMultiChannelData(data: PlotData): data is MultiChannelPlotData {
  return (data as MultiChannelPlotData).traces !== undefined
}

export function Chart(props: {
  data: PlotData
  onChange?: (item: string) => void // Make onChange optional
  selectedChannelIndex?: number
  mutedChannels?: number[]
}) {
  // Depending on data type, render appropriate component
  if (isMultiChannelData(props.data)) {
    return (
      <MultiChannelChart
        data={props.data}
        selectedChannelIndex={props.selectedChannelIndex}
        mutedChannels={props.mutedChannels}
      />
    )
  } else {
    // Ensure onChange is passed, as it's required for SingleFilterChart
    if (!props.onChange) {
      console.error("onChange prop is required for SingleFilterChart")
      return null
    }
    return <SingleFilterChart data={props.data} onChange={props.onChange} />
  }
}
