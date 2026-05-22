// ===== File: src/utilities/MultiChannelChart.tsx (FINAL VERSION WITH FILL) =====

import React, { useCallback, useMemo, useRef } from "react"
import { Scatter } from "react-chartjs-2"
import { mdiHome, mdiImage, mdiTable } from "@mdi/js"
import { cssStyles, MdiButton } from "./ui-components"
import {
  Chart as ChartJS,
  Legend,
  LinearScale,
  LogarithmicScale,
  LineElement,
  PointElement,
  Tooltip,
  ChartOptions,
  Filler,
} from "chart.js"
import zoomPlugin from "chartjs-plugin-zoom"
import { CHANNEL_COLORS } from "./chart"

ChartJS.register(LinearScale, LogarithmicScale, PointElement, LineElement, Tooltip, Legend, zoomPlugin, Filler)

export interface MultiChannelPlotData {
  name: string
  f: number[]
  traces: Array<{
    name: string
    magnitude?: number[]
    phase?: number[]
    peq_points?: Array<{ x: number; y: number }>
  }>
}

function make_pointlist(xvect: number[], yvect: number[]): { x: number; y: number }[] {
  return xvect.map((x, idx) => ({ x: x, y: yvect[idx] }))
}

export function MultiChannelChart(props: {
  data: MultiChannelPlotData
  selectedChannelIndex?: number
  mutedChannels?: number[]
}) {
  const chartRef = useRef<ChartJS<"scatter">>(null)

  const colors = useMemo(() => CHANNEL_COLORS, [])

  const chartJSData = useMemo(() => {
    const datasets: any[] = []
    props.data.traces.forEach((trace, index) => {
      const color = colors[index % colors.length]

      const isSelected = props.selectedChannelIndex === index
      const isMuted = props.mutedChannels?.includes(index)

      const finalBorderColor = isMuted ? `${color}50` : color
      // Fill color: more transparent for unselected or muted
      const finalBackgroundColor = isMuted ? `${color}20` : `${color}33`

      // --- 1. Main frequency response line ---
      if (trace.magnitude) {
        datasets.push({
          label: trace.name,
          data: make_pointlist(props.data.f, trace.magnitude),
          pointRadius: 0,
          showLine: true,
          yAxisID: "gain",
          xAxisID: "freq",
          borderWidth: isSelected ? 5 : 2.5,
          borderColor: finalBorderColor,
          // Fill only for selected channel
          fill: isSelected ? "start" : false,
          backgroundColor: finalBackgroundColor,
          // Disable line value display in common tooltip to avoid cluttering
          tooltip: {
            callbacks: {
              label: (context: any) => {
                // Show label only if this is the only point under cursor
                // or can just return empty string if you want only channel name in legend
                return ` ${context.dataset.label}: ${context.parsed.y.toFixed(2)} dB`
              },
            },
          },
          order: 1, // Drawn BEHIND markers
        })
      }

      // --- 2. PEQ markers (if any) ---
      if (trace.peq_points && trace.peq_points.length > 0) {
        datasets.push({
          label: `${trace.name} PEQ`,
          data: trace.peq_points,
          yAxisID: "gain",
          xAxisID: "freq",
          type: "scatter", // Explicitly specify type, though it's inherited
          showLine: false, // No lines between markers needed

          // Marker style
          pointStyle: "circle",
          pointRadius: isSelected ? 8 : 6, // Selected slightly larger
          pointHoverRadius: isSelected ? 10 : 8,
          pointBackgroundColor: isMuted ? `${color}99` : color,
          pointBorderColor: "#ffffff0e", // White border for contrast
          pointBorderWidth: 2,

          // Tooltip specifically for marker
          tooltip: {
            callbacks: {
              label: (context: any) => {
                return ` PEQ: ${context.parsed.y.toFixed(1)} dB @ ${context.parsed.x} Hz`
              },
            },
          },
          order: 0, // Drawn ON TOP of line
        })
      }
    })
    return { datasets }
  }, [props.data, colors, props.selectedChannelIndex, props.mutedChannels])

  const options = useMemo((): ChartOptions<"scatter"> => {
    const styles = cssStyles()
    const axesColor = styles.getPropertyValue("--axes-color")
    const textColor = styles.getPropertyValue("--text-color")
    const gainColor = styles.getPropertyValue("--text-color")

    return {
      scales: {
        freq: {
          type: "logarithmic",
          position: "bottom",
          min: 20,
          max: 20000,
          title: { display: false, text: "Frequency, Hz", color: textColor },
          grid: { color: axesColor },
          ticks: {
            color: textColor,
            callback: (value) => {
              const numericValue = Number(value)
              if ([20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000].includes(numericValue)) {
                return numericValue >= 1000 ? `${numericValue / 1000}k` : numericValue.toString()
              }
              return null // Hide all other intermediate labels
            },
            maxTicksLimit: 20,
          },
        },
        gain: {
          type: "linear",
          position: "left",
          min: -15,
          max: 10,
          title: { display: true, text: "Gain, dB", color: gainColor },
          grid: { color: axesColor, borderDash: [7, 3] },
          ticks: {
            color: gainColor,
            stepSize: 3,
          },
        },
      },
      plugins: {
        zoom: {
          pan: { enabled: false, mode: "xy" },
          zoom: { wheel: { enabled: false }, pinch: { enabled: false }, mode: "xy" },
        },
        legend: {
          display: false,
        },
        tooltip: {
          mode: "index",
          intersect: false,
          callbacks: {
            title: (tooltipItems) => `Freq: ${tooltipItems[0].parsed.x.toFixed(1)} Hz`,
          },
        },
      },
      animation: { duration: 0 },
      maintainAspectRatio: false,
    }
  }, [])

  // 1. Download chart as PNG image
  const downloadPlot = useCallback(() => {
    if (chartRef.current !== null) {
      const link = document.createElement("a")
      link.download = (props.data.name || "multichannel_plot").replace(/\s/g, "_") + ".png"
      link.href = chartRef.current.toBase64Image()
      link.click()
    }
  }, [props.data.name])

  // 2. Reset chart zoom
  const resetView = useCallback(() => {
    if (chartRef.current !== null) {
      chartRef.current.resetZoom()
    }
  }, [])

  // 3. Smart export of all channels' magnitude response to a single CSV file
  const downloadData = useCallback(() => {
    // Create table header: frequency, "Ch 1_magnitude", "Ch 2_magnitude"...
    const header = ["frequency", ...props.data.traces.map((t) => `"${t.name}_magnitude"`)].join(",")

    // Map each frequency to corresponding amplitude values across all channels
    const rows = props.data.f.map((freq, freqIdx) => {
      const rowData = [freq]
      props.data.traces.forEach((trace) => {
        rowData.push(trace.magnitude ? trace.magnitude[freqIdx] : "")
      })
      return rowData.join(",")
    })

    const csvContent = "data:text/csv;charset=utf-8," + header + "\n" + rows.join("\n")
    const link = document.createElement("a")
    link.download = (props.data.name || "multichannel_data").replace(/\s/g, "_") + ".csv"
    link.href = encodeURI(csvContent)
    link.click()
  }, [props.data.f, props.data.traces, props.data.name])

  return (
    <div style={{ height: "350px", position: "relative", zoom: "1.2", width: "1500px" }}>
      <Scatter data={chartJSData} options={options} ref={chartRef} />
      <div
        className="plot-controls"
        style={{ position: "absolute", top: "5px", right: "5px", display: "none", gap: "5px" }}
      >
        <MdiButton icon={mdiImage} tooltip="Save plot as PNG" onClick={downloadPlot} />
        <MdiButton icon={mdiTable} tooltip="Save plot data as CSV" onClick={downloadData} />
        <MdiButton icon={mdiHome} tooltip="Reset zoom" onClick={resetView} />
      </div>
    </div>
  )
}
