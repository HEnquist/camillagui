import * as React from "react"
import {VolumeBox} from "./sidepanel/volumebox"
import {MdiButton} from "./utilities/ui-components"
import {mdiImageSizeSelectSmall} from "@mdi/js"
import {Config} from "./camilladsp/config"
import {defaultStatus} from "./camilladsp/status"
import {Update} from "./utilities/common"
import {BassAndTreble, QuickConfigSwitch} from "./shortcuts"

export function isCompactViewEnabled(): boolean {
  return new URLSearchParams(window.location.search).has("compactview")
}

export function setCompactViewEnabled(enabled: boolean) {
  const url = new URL(window.location.href);
  if (enabled) {
    url.searchParams.set('compactview', "");
  }
  else {
    url.searchParams.delete('compactview');
  }
  window.history.pushState(
      undefined,
      'CamillaDSP',
      url.href
  )
}

export function CompactView(props: {
  currentConfigName?: string
  config: Config
  updateConfig: (update: Update<Config>) => void
  setConfig: (name: string, config: Config) => void
  disableCompactView: () => void
}) {
  const {currentConfigName, config, setConfig, updateConfig, disableCompactView} = props
  return <div className="tabpanel" style={{margin: 'auto'}}>
    <DisableCompactViewButton disableCompactView={disableCompactView}/>
    <VolumeBox vuMeterStatus={defaultStatus()} setMessage={() => {}}/>
    <BassAndTreble config={config} updateConfig={updateConfig}/>
    <QuickConfigSwitch setConfig={setConfig} currentConfigName={currentConfigName}/>
  </div>
}

function DisableCompactViewButton(props: { disableCompactView: () => void }) {
  return <MdiButton
      icon={mdiImageSizeSelectSmall}
      tooltip="Change to normal view"
      onClick={props.disableCompactView}
  />
}