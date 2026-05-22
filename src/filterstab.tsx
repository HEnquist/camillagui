// ===== File: src/filterstab.tsx (Updated version) =====

import React from "react"
import { Config } from "./camilladsp/config"
import { Update } from "./utilities/common"
import { Errors } from "./utilities/errors"

// Import our two new components
import { ClassicFiltersView } from "./ClassicFiltersView"
import { MultichannelFiltersView } from "./MultichannelFiltersView"

// Define props that will be passed further
export interface FiltersTabProps {
  config: Config
  samplerate: number
  channels: Promise<number>
  coeffDir: string
  updateConfig: (update: Update<Config>) => void
  errors: Errors
  activeChannelTab: number | "common"
  onChannelTabChange: (tabIndex: number | "common") => void
}

/**
 * Checks for the presence of 'xover' mixer in the configuration.
 * @param config - Current CamillaDSP configuration.
 * @returns true if mixer is found, otherwise false.
 */
const hasXoverMixer = (config: Config): boolean => {
  if (!config.mixers) {
    return false
  }
  // Case-insensitive search
  return Object.keys(config.mixers).some((name) => name.toLowerCase() === "xover")
}

/**
 * New FiltersTab - now it's just a "dispatcher".
 * It decides which filter interface view to show: classic or multi-channel.
 */
export class FiltersTab extends React.Component<FiltersTabProps> {
  render() {
    // Check if 'xover' mixer exists
    if (hasXoverMixer(this.props.config)) {
      // If yes, show new multi-channel interface
      return <MultichannelFiltersView {...this.props} />
    } else {
      // If no, show the good old classic interface
      return <ClassicFiltersView {...this.props} />
    }
  }
}
