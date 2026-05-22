// ===== File: src/MultichannelFiltersView.tsx (COMPLETE FIXED VERSION) =====
// At the very top of MultichannelFiltersView.tsx
import { Chart } from "./utilities/chart" // Our new chart manager
import { MultiChannelPlotData } from "./utilities/MultiChannelChart" // Our new data structure
import React, { useState, useEffect, useMemo } from "react" // Add useEffect and useMemo
import { Box, MdiButton, FloatOption, AddButton, EnumOption, IntOption } from "./utilities/ui-components"
import { loadFiles, FileInfo } from "./utilities/files"
import {
  Config,
  Filter,
  newFilterName,
  DefaultFilterParameters,
  defaultFilter,
  renameFilter,
  removeFilter,
  Mixer,
} from "./camilladsp/config"
import { Errors } from "./utilities/errors"
import { Update } from "./utilities/common"
import { FiltersTabProps } from "./filterstab"
import { ClassicFiltersView, FilterView } from "./ClassicFiltersView" // Reuse!
import { mdiPlusMinusVariant, mdiVolumeOff, mdiToggleSwitch, mdiToggleSwitchOffOutline } from "@mdi/js"
import cloneDeep from "lodash/cloneDeep"
// At the beginning of MultichannelFiltersView.tsx
import { CHANNEL_COLORS } from "./utilities/chart"

// --- Configuration management helper block ---

const XOVER_MIXER_NAME = "xover"

/**
 * Generates a standardized name for a "key" filter.
 */
const getKeyFilterName = (channelIndex: number, type: "hpf" | "lpf" | "gain" | "delay"): string => {
  return `${XOVER_MIXER_NAME}_ch${channelIndex + 1}_${type}`
}

/**
 * Checks if a filter is a "key" (system) filter by its name.
 */
const isKeyFilter = (filterName: string): boolean => {
  return filterName.startsWith(`${XOVER_MIXER_NAME}_ch`)
}

/**
 * Finds all additional (non-key) filters applied to a specific channel in the pipeline.
 */
const findAdditionalFiltersForChannel = (config: Config, channelIndex: number): string[] => {
  if (!config.pipeline) return []
  const additionalFilters: Set<string> = new Set()
  for (const step of config.pipeline) {
    if (step.type === "Filter" && step.channels?.includes(channelIndex)) {
      step.names.forEach((filterName) => {
        if (!isKeyFilter(filterName)) {
          additionalFilters.add(filterName)
        }
      })
    }
  }
  return Array.from(additionalFilters)
}

/**
 * Finds all "common" filters (those not bound to xover channels).
 */
const findCommonFilterNames = (config: Config): string[] => {
  if (!config.filters) return []
  const allFilterNames = Object.keys(config.filters)
  // FIXED: Use Object.entries to search for mixer by name (key)
  const xoverMixerEntry = Object.entries(config.mixers || {}).find(
    ([name, _]) => name.toLowerCase() === XOVER_MIXER_NAME,
  )
  const channelCount = xoverMixerEntry ? xoverMixerEntry[1].channels.out : 0

  const assignedFilterNames = new Set<string>()
  for (let i = 0; i < channelCount; i++) {
    ;["hpf", "lpf", "gain", "delay"].forEach((type) => assignedFilterNames.add(getKeyFilterName(i, type as any)))
    findAdditionalFiltersForChannel(config, i).forEach((name) => assignedFilterNames.add(name))
  }

  return allFilterNames.filter((name) => !assignedFilterNames.has(name))
}

/**
 * Toggles bypass for a specific filter across the entire pipeline chain.
 */
export const toggleFilterBypassInPipeline = (config: Config, filterName: string, bypassed: boolean) => {
  if (!config.pipeline) return
  config.pipeline.forEach((step) => {
    if (step.type === "Filter" && step.names.includes(filterName)) {
      step.bypassed = bypassed ? true : null
    }
  })
}

/**
 * Adds a new filter to the pipeline for a specific channel.
 */
export const addFilterToPipeline = (config: Config, filterName: string, channelIndex: number) => {
  if (!config.pipeline) config.pipeline = []
  config.pipeline.push({
    type: "Filter",
    names: [filterName],
    channels: [channelIndex],
    bypassed: false,
    description: `Additional filter for channel ${channelIndex + 1}`,
  })
}

/**
 * Removes a filter from all pipeline steps. If a step becomes empty, removes it as well.
 */
const removeFilterFromPipeline = (config: Config, filterName: string) => {
  if (!config.pipeline) return
  config.pipeline = config.pipeline
    .map((step) => {
      if (step.type === "Filter" && step.names.includes(filterName)) {
        step.names = step.names.filter((name) => name !== filterName)
      }
      return step
    })
    .filter((step) => !(step.type === "Filter" && step.names.length === 0))
}

// --- Main multi-channel mode component ---

export const MultichannelFiltersView: React.FC<FiltersTabProps> = (props) => {
  const { config, samplerate, activeChannelTab, onChannelTabChange } = props
  const [selectedTab, setSelectedTab] = useState<number | "common">(activeChannelTab)

  // --- FIXED: Add effect for synchronization ---
  // This code will run when component loads or when prop `activeChannelTab` changes.
  useEffect(() => {
    setSelectedTab(activeChannelTab)
  }, [activeChannelTab])

  const [plotData, setPlotData] = useState<MultiChannelPlotData | null>(null)
  const [ignoredFilters, setIgnoredFilters] = useState<string[]>([])
  const [availableCoeffFiles, setAvailableCoeffFiles] = useState<FileInfo[]>([])

  useEffect(() => {
    loadFiles("coeff").then(
      (files) => setAvailableCoeffFiles(files),
      (error) => console.error("Could not load stored coeffs in multichannel view", error),
    )
  }, [])

  const xoverMixerEntry = Object.entries(config.mixers || {}).find(
    ([name, _]) => name.toLowerCase() === XOVER_MIXER_NAME,
  )
  const channelCount = xoverMixerEntry ? xoverMixerEntry[1].channels.out : 0

  // ===== Replace in MultichannelFiltersView.tsx (entire useEffect block) =====

  useEffect(() => {
    const handler = setTimeout(() => {
      const channels_to_plot: { name: string; filters: string[] }[] = []
      const newIgnoredFilterTypes = new Set<string>()

      const UNSUPPORTED_TYPES = ["Limiter"]
      const UNSUPPORTED_SUBTYPES = ["GeneralNotch"]

      for (let i = 0; i < channelCount; i++) {
        const channelLabel = xoverMixerEntry?.[1].labels?.[i] || `Ch ${i + 1}`

        const keyFilters = ["hpf", "lpf", "gain", "delay"].map((type) => getKeyFilterName(i, type as any))
        const additionalFilters = findAdditionalFiltersForChannel(config, i)
        const allFiltersForChannel = [...keyFilters, ...additionalFilters]

        const validFiltersForChannel: string[] = []

        allFiltersForChannel.forEach((name) => {
          const isBypassed = config.pipeline?.some(
            (s) => s.type === "Filter" && s.names.includes(name) && s.bypassed === true,
          )
          if (isBypassed) return

          const filterDef = config.filters?.[name]
          if (!filterDef) return

          let isIgnored = false
          let ignoredReason = "" // We'll store the reason

          if (UNSUPPORTED_TYPES.includes(filterDef.type)) {
            isIgnored = true
            ignoredReason = filterDef.type // Reason - main type
          }

          if (filterDef.parameters?.type && UNSUPPORTED_SUBTYPES.includes(filterDef.parameters.type)) {
            isIgnored = true
            ignoredReason = filterDef.parameters.type // Reason - subtype
          }

          if (filterDef.type === "Conv" && (!filterDef.parameters.filename || filterDef.parameters.filename === "")) {
            isIgnored = true
            ignoredReason = "Conv (empty)" // Special reason for empty convolver
          }

          if (isIgnored) {
            newIgnoredFilterTypes.add(ignoredReason) // Add TYPE to Set, not name
          } else {
            validFiltersForChannel.push(name)
          }
        })

        channels_to_plot.push({ name: channelLabel, filters: validFiltersForChannel })
      }

      // Update state with types/subtypes
      setIgnoredFilters(Array.from(newIgnoredFilterTypes))

      // --- Send request ---
      console.log("Requesting plot data from backend with:", { channels_to_plot })

      fetch("/api/evalchannels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: config,
          samplerate: samplerate,
          channels_to_plot: channels_to_plot,
        }),
      })
        .then((res) => (res.ok ? res.json() : Promise.reject(res)))
        .then((data) => {
          setPlotData(data)
        })
        .catch((error) => {
          console.error("Error fetching plot data:", error)
          // On error, create "empty" chart so the frame remains
          const emptyData: MultiChannelPlotData = {
            name: "Error loading data",
            f: [20, 20000],
            traces: [],
          }
          setPlotData(emptyData)
        })
    }, 300)

    return () => clearTimeout(handler)
  }, [config, channelCount, xoverMixerEntry, samplerate]) // Added samplerate to dependencies

  const commonFilterNames = findCommonFilterNames(config)
  const commonFiltersConfig = useMemo(() => {
    const commonFilterNames = findCommonFilterNames(config)
    const newCommonConfig = cloneDeep(config)
    if (newCommonConfig.filters) {
      Object.keys(newCommonConfig.filters).forEach((name) => {
        if (!commonFilterNames.includes(name)) {
          delete newCommonConfig.filters![name]
        }
      })
    }
    return newCommonConfig
  }, [config])

  return (
    <div className="tabpanel" style={{ width: "auto", padding: "30px" }}>
      <div className="main-plot-container" style={{ marginBottom: "20px" }}>
        {/* --- FIXED: Always render Chart if plotData exists (even empty) --- */}
        {plotData ? (
          <>
            <Chart
              data={plotData}
              selectedChannelIndex={typeof selectedTab === "number" ? selectedTab : -1}
              mutedChannels={[...Array(channelCount).keys()].filter(
                (i) => config.filters?.[getKeyFilterName(i, "gain")]?.parameters.mute === true,
              )}
            />
            {/* --- NEW: Warning block --- */}
            {ignoredFilters.length > 0 && (
              <div
                className="plot-warning"
                style={{ textAlign: "center", color: "var(--error-text-color)", fontSize: "0.9em", marginTop: "5px" }}
              >
                Filters not displayed on chart: {ignoredFilters.join(", ")}
              </div>
            )}
          </>
        ) : (
          // Show placeholder while first load is in progress
          <div
            style={{
              height: "420px",
              width: "1750px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "var(--box-border)",
              borderRadius: "var(--border-radius)",
            }}
          >
            Loading chart...
          </div>
        )}
      </div>

      <div className="channel-tabs-container">
        {[...Array(channelCount).keys()].map((i) => (
          <ChannelTabHeader
            key={i}
            channelIndex={i}
            isActive={selectedTab === i}
            // --- FIXED: Add double action ---
            onClick={() => {
              setSelectedTab(i)
              onChannelTabChange(i)
            }}
            {...props}
          />
        ))}
        <div
          className={`channel-tab-button ${selectedTab === "common" ? "active" : ""}`}
          // --- FIXED: Double action ---
          onClick={() => {
            setSelectedTab("common")
            onChannelTabChange("common")
          }}
        >
          Common Filters
        </div>
      </div>

      {typeof selectedTab === "number" && (
        <SelectedChannelDetails
          channelIndex={selectedTab}
          availableCoeffFiles={availableCoeffFiles}
          setAvailableCoeffFiles={setAvailableCoeffFiles}
          {...props}
        />
      )}

      {selectedTab === "common" && (
        <Box title="Common Filters...">
          <ClassicFiltersView
            {...props}
            // Pass always fresh, recalculated version
            config={commonFiltersConfig}
          />
        </Box>
      )}
    </div>
  )
}

// --- Internal components ---

interface ChannelComponentProps extends FiltersTabProps {
  channelIndex: number
}

const ChannelTabHeader: React.FC<ChannelComponentProps & { isActive: boolean; onClick: () => void }> = ({
  channelIndex,
  isActive,
  onClick,
  config,
  updateConfig,
}) => {
  const gainFilterName = getKeyFilterName(channelIndex, "gain")
  const delayFilterName = getKeyFilterName(channelIndex, "delay")
  const gainFilter = config.filters?.[gainFilterName]
  const delayFilter = config.filters?.[delayFilterName]
  const isMuted = gainFilter?.parameters.mute === true

  const xoverMixerEntry = Object.entries(config.mixers || {}).find(
    ([name, _]) => name.toLowerCase() === XOVER_MIXER_NAME,
  )
  const xoverMixer = xoverMixerEntry ? xoverMixerEntry[1] : undefined
  const channelLabel = xoverMixer?.labels?.[channelIndex] || null
  const tabTitle = `Ch ${channelIndex + 1}` + (channelLabel ? ` - ${channelLabel}` : "")

  const borderColor = CHANNEL_COLORS[channelIndex % CHANNEL_COLORS.length]

  const updateKeyParam = (type: "gain" | "delay", param: string, value: any) => {
    const filterName = getKeyFilterName(channelIndex, type)
    updateConfig((cfg) => {
      if (cfg.filters?.[filterName]) {
        ;(cfg.filters[filterName].parameters as any)[param] = value
      }
    })
  }

  return (
    <div className={`channel-tab-button ${isActive ? "active" : ""} ${isMuted ? "channel-muted" : ""}`}>
      <div className="channel-tab-title" onClick={onClick} style={{ borderColor: borderColor }}>
        {tabTitle}
      </div>
      <div className="channel-tab-controls">
        {delayFilter && (
          <FloatOption
            desc="Delay, ms"
            tooltip="Delay for this channel"
            value={delayFilter.parameters.delay}
            onChange={(val) => updateKeyParam("delay", "delay", val)}
            withControls={true}
            step={0.1}
            forceDecimals={1}
          />
        )}

        {gainFilter && (
          <FloatOption
            desc="Gain, dB"
            tooltip="Total gain for this channel"
            value={gainFilter.parameters.gain}
            onChange={(val) => updateKeyParam("gain", "gain", val)}
            withControls={true}
            step={0.5}
            forceDecimals={1}
          />
        )}

        <div className="channel-tab-buttons">
          {gainFilter && (
            <MdiButton
              icon={mdiVolumeOff}
              highlighted={gainFilter.parameters.mute}
              onClick={() => updateKeyParam("gain", "mute", !gainFilter.parameters.mute)}
              tooltip="Mute"
            />
          )}
          {gainFilter && (
            <MdiButton
              icon={mdiPlusMinusVariant}
              highlighted={gainFilter.parameters.inverted}
              onClick={() => updateKeyParam("gain", "inverted", !gainFilter.parameters.inverted)}
              tooltip="Invert polarity"
            />
          )}
        </div>
      </div>
    </div>
  )
}

const SelectedChannelDetails: React.FC<
  ChannelComponentProps & {
    availableCoeffFiles: FileInfo[]
    setAvailableCoeffFiles: React.Dispatch<React.SetStateAction<FileInfo[]>>
  }
> = (props) => {
  const { config, channelIndex, availableCoeffFiles, setAvailableCoeffFiles } = props
  const gainFilterName = getKeyFilterName(channelIndex, "gain")
  const isMuted = config.filters?.[gainFilterName]?.parameters.mute === true

  const xoverMixer = Object.entries(config.mixers || {}).find(
    ([name, _]) => name.toLowerCase() === XOVER_MIXER_NAME,
  )?.[1]
  const title = `Filter settings for ${xoverMixer?.labels?.[channelIndex] || `channel ${channelIndex + 1}`}`

  // FIXED: Wrap Box in div with dynamic class
  return (
    <div className={isMuted ? "channel-muted" : ""} style={{ width: "100%", height: "100%" }}>
      <div className="channel-details-grid">
        <CrossoverBlock {...props} />
        <div className="additional-filters-wrapper">
          <AdditionalFiltersRow
            {...props}
            availableCoeffFiles={availableCoeffFiles}
            setAvailableCoeffFiles={setAvailableCoeffFiles}
          />
        </div>
      </div>
    </div>
  )
}

// ===== Replace in MultichannelFiltersView.tsx (CrossoverBlock component) =====

// ===== Replace in MultichannelFiltersView.tsx (CrossoverBlock component) =====

const CrossoverBlock: React.FC<ChannelComponentProps> = ({ channelIndex, config, updateConfig }) => {
  const hpfName = getKeyFilterName(channelIndex, "hpf")
  const lpfName = getKeyFilterName(channelIndex, "lpf")
  const hpf = config.filters?.[hpfName]
  const lpf = config.filters?.[lpfName]

  const isBypassed = (name: string) =>
    config.pipeline?.some((s) => s.type === "Filter" && s.names.includes(name) && s.bypassed === true)

  const handleBypassToggle = (filterName: string) => {
    updateConfig((cfg) => {
      toggleFilterBypassInPipeline(cfg, filterName, !isBypassed(filterName))
    })
  }

  const updateKeyParam = (type: "hpf" | "lpf", param: string, value: any) => {
    const filterName = getKeyFilterName(channelIndex, type)
    updateConfig((cfg) => {
      if (cfg.filters?.[filterName]) {
        const currentParams = cfg.filters[filterName].parameters
        cfg.filters[filterName].parameters = {
          ...currentParams,
          [param]: value,
        }
      }
    })
  }

  const isFrequencyChangeDangerous = (oldVal: number, newVal: number): boolean => {
    if (newVal < 1 || oldVal < 1) return false
    const ratio = oldVal > newVal ? oldVal / newVal : newVal / oldVal
    const octaveDifference = Math.log2(ratio)
    return octaveDifference > 2.0
  }

  if (!hpf || !lpf) return <div>Error: Key crossover filters not found!</div>

  return (
    <div className="crossover-block-flex">
      <div className="crossover-labels">
        <div className="crossover-label-header">&nbsp;</div>
        <div className="crossover-label">Type</div>
        <div className="crossover-label">Order</div>
        <div className="crossover-label">Frequency</div>
      </div>

      <div className={`crossover-column ${isBypassed(hpfName) ? "filter-bypassed" : ""}`}>
        <div className="crossover-column-header">
          <span>HPF</span>
          <MdiButton
            icon={isBypassed(hpfName) ? mdiToggleSwitchOffOutline : mdiToggleSwitch}
            highlighted={isBypassed(hpfName)}
            onClick={() => handleBypassToggle(hpfName)}
            tooltip="Bypass"
          />
        </div>
        <EnumOption
          desc=""
          tooltip="Filter type"
          value={hpf.parameters.type}
          options={["LinkwitzRileyHighpass", "ButterworthHighpass"]}
          onChange={(val) => updateKeyParam("hpf", "type", val)}
        />
        <IntOption
          desc=""
          tooltip="Filter order"
          value={hpf.parameters.order}
          onChange={(val) => updateKeyParam("hpf", "order", val)}
          withControls={true}
          step={1}
        />
        <div className="input-with-unit">
          <FloatOption
            desc=""
            tooltip="Cutoff frequency"
            value={hpf.parameters.freq}
            onChange={(val) => updateKeyParam("hpf", "freq", val)}
            withControls={true}
            step={10}
            isDangerousChange={isFrequencyChangeDangerous}
          />
          <span className="unit-label">Hz</span>
        </div>
      </div>

      <div className={`crossover-column ${isBypassed(lpfName) ? "filter-bypassed" : ""}`}>
        <div className="crossover-column-header">
          <span>LPF</span>
          <MdiButton
            icon={isBypassed(lpfName) ? mdiToggleSwitchOffOutline : mdiToggleSwitch}
            highlighted={isBypassed(lpfName)}
            onClick={() => handleBypassToggle(lpfName)}
            tooltip="Bypass"
          />
        </div>
        <EnumOption
          desc=""
          tooltip="Filter type"
          value={lpf.parameters.type}
          options={["LinkwitzRileyLowpass", "ButterworthLowpass"]}
          onChange={(val) => updateKeyParam("lpf", "type", val)}
        />
        <IntOption
          desc=""
          tooltip="Filter order"
          value={lpf.parameters.order}
          onChange={(val) => updateKeyParam("lpf", "order", val)}
          withControls={true}
          step={1}
        />
        <div className="input-with-unit">
          <FloatOption
            desc=""
            tooltip="Cutoff frequency"
            value={lpf.parameters.freq}
            onChange={(val) => updateKeyParam("lpf", "freq", val)}
            withControls={true}
            step={10}
            isDangerousChange={isFrequencyChangeDangerous}
          />
          <span className="unit-label">Hz</span>
        </div>
      </div>
    </div>
  )
}

const AdditionalFiltersRow: React.FC<
  ChannelComponentProps & {
    availableCoeffFiles: FileInfo[]
    setAvailableCoeffFiles: React.Dispatch<React.SetStateAction<FileInfo[]>>
  }
> = (props) => {
  const { channelIndex, config, updateConfig, availableCoeffFiles, setAvailableCoeffFiles } = props
  const additionalFilters = findAdditionalFiltersForChannel(config, channelIndex)

  const addPeq = () => {
    updateConfig((cfg) => {
      const newName = newFilterName(cfg.filters)
      if (!cfg.filters) cfg.filters = {}
      const newPeq: Filter = {
        type: "Biquad",
        // Now we assign a string to a field expecting `string | null`, which is correct.
        description: `Filter for ch ${channelIndex + 1}`,
        parameters: { ...DefaultFilterParameters.Biquad.Peaking },
      }

      cfg.filters[newName] = newPeq
      addFilterToPipeline(cfg, newName, channelIndex)
    })
  }
  const handleRemove = (filterName: string) => {
    updateConfig((cfg) => {
      removeFilterFromPipeline(cfg, filterName)
      removeFilter(cfg, filterName)
    })
  }

  // FIXED: Add isFreeFilterName function required for FilterView
  const isFreeFilterName = (name: string): boolean => !config.filters || !Object.keys(config.filters).includes(name)

  return (
    <div className="additional-filters-row">
      {additionalFilters.map((filterName) => (
        <div key={filterName} className="additional-filter-item">
          <FilterView
            {...props}
            name={filterName}
            filter={config.filters![filterName]}
            errors={props.errors.forSubpath("filters", filterName)}
            updateFilter={(update: Update<Filter>) => updateConfig((cfg) => update(cfg.filters![filterName]))}
            rename={(newName: string) => {
              // --- SAFETY CHECK ---
              if (!config.filters?.[filterName]) {
                return // If old name no longer exists, do nothing
              }
              updateConfig((cfg) => renameFilter(cfg, filterName, newName))
            }}
            remove={() => handleRemove(filterName)}
            isFreeFilterName={isFreeFilterName}
            availableCoeffFiles={availableCoeffFiles}
            updateAvailableCoeffFiles={() => {
              loadFiles("coeff").then(
                (files) => setAvailableCoeffFiles(files),
                (error) => console.error(error),
              )
            }}
          />
        </div>
      ))}
      <AddButton onClick={addPeq} tooltip="Add parametric equalizer (PEQ)" />
    </div>
  )
}
