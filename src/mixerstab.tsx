import React from "react"
import "./index.css"
import {
  AddButton,
  Box,
  DeleteButton,
  ErrorMessage,
  IntOption,
  FloatOption,
  MdiButton,
  ParsedInput,
  OptionalTextInput,
  OptionalEnumOption,
  StringListOption
} from "./utilities/ui-components"
import {
  Config,
  defaultMapping,
  defaultMixer,
  defaultSource,
  Mapping,
  Mixer,
  mixerNamesOf,
  newMixerName,
  removeMixer,
  renameMixer,
  Source,
  GainScales,
  getMixerInputLabels,
  getLabelForChannel
} from "./camilladsp/config"
import {mdiPlusMinusVariant, mdiVolumeOff} from "@mdi/js"
import {ErrorsForPath, errorsForSubpath} from "./utilities/errors"
import {modifiedCopyOf, Update} from "./utilities/common"

export class MixersTab extends React.Component<{
  config: Config
  errors: ErrorsForPath
  updateConfig: (update: Update<Config>) => void
}, {
  mixerKeys: { [name: string]: number}
}> {
  constructor(props: any) {
    super(props)
    this.mixerNames = this.mixerNames.bind(this)
    this.addMixer = this.addMixer.bind(this)
    this.updateMixer = this.updateMixer.bind(this)
    this.renameMixer = this.renameMixer.bind(this)
    this.removeMixer = this.removeMixer.bind(this)
    this.isFreeMixerName = this.isFreeMixerName.bind(this)
    this.state = {
      mixerKeys: {}
    }
    this.mixerNames().forEach((name, i) => this.state.mixerKeys[name] = i)
  }

  private mixerNames(): string[] {
    return mixerNamesOf(this.props.config.mixers)
  }

  private updateMixer(name: string, update: Update<Mixer>) {
    this.props.updateConfig(config => {
      if (!config.mixers) {
        config.mixers = {}
      }
      update(config.mixers[name])
    })
  }

  private addMixer() {
    this.props.updateConfig(config => {
      const newMixer = newMixerName(config.mixers)
      this.setState(oldState =>
          modifiedCopyOf(oldState, newState =>
              newState.mixerKeys[newMixer] = 1 + Math.max(0, ...Object.values(oldState.mixerKeys))
          )
      )
      if (config.mixers === null) {
        config.mixers = {}
      }
      config.mixers[newMixer] = defaultMixer()
    })
  }

  private removeMixer(name: string) {
    this.props.updateConfig(config => {
      removeMixer(config, name)
      this.setState(oldState =>
          modifiedCopyOf(oldState, newState => delete newState.mixerKeys[name])
      )
    })
  }

  private renameMixer(oldName: string, newName: string) {
    if (this.isFreeMixerName(newName))
      this.props.updateConfig(config => {
        this.setState(oldState =>
            modifiedCopyOf(oldState, newState => {
              newState.mixerKeys[newName] = newState.mixerKeys[oldName]
              delete newState.mixerKeys[oldName]
            }))
        renameMixer(config, oldName, newName)
      })
  }

  private isFreeMixerName(name: string) {
    return !this.mixerNames().includes(name)
  }

  render() {
    const {config, errors} = this.props
    const mixers = config.mixers ? config.mixers : {}
    return (
        <div className="tabpanel" style={{width: '700px'}}>
          <ErrorMessage message={errors({path: []})}/>
          {this.mixerNames()
              .map(name =>
                  <MixerView
                      key={this.state.mixerKeys[name]}
                      name={name}
                      mixer={mixers[name]}
                      config={config}
                      errors={errorsForSubpath(errors, name)}
                      update={update => this.updateMixer(name, update)}
                      isFreeMixerName={this.isFreeMixerName}
                      rename={newName => this.renameMixer(name, newName)}
                      remove={() => this.removeMixer(name)}
                  />
              )
          }
          <div>
            <AddButton tooltip="Add a new mixer" onClick={this.addMixer}/>
          </div>
        </div>
    )
  }
}

function MixerView(props: {
  name: string
  mixer: Mixer
  config: Config
  errors: ErrorsForPath
  isFreeMixerName: (name: string) => boolean
  rename: (newName: string) => void
  remove: () => void
  update: (update: Update<Mixer>) => void
}) {
  const {name, mixer, config, errors, rename, remove, update} = props
  const isValidMixerName = (newName: string) =>
      name === newName || (newName.trim().length > 0 && props.isFreeMixerName(newName))
  const input_labels = getMixerInputLabels(config, name)
  return <Box title={
    <>
      <ParsedInput
          value={name}
          style={{width: '300px'}}
          tooltip="Mixer name, must be unique"
          onChange={rename}
          asString={name => name}
          parseValue={name => isValidMixerName(name) ? name : undefined}
          immediate={false}
      />
      <DeleteButton
          tooltip="Delete this mixer"
          smallButton={true}
          onClick={remove}/>
    </>
  }>
    <ErrorMessage message={errors({path: []})}/>
    <div style={{display: 'flex', justifyContent: 'space-evenly'}}>
      <IntOption
          value={mixer.channels.in}
          desc="in"
          tooltip="Number of channels in (source channels)"
          small={true}
          withControls={true}
          min={1}
          onChange={channelsIn => update(mixer => mixer.channels.in = channelsIn)}/>
      <IntOption
          value={mixer.channels.out}
          desc="out"
          tooltip="Number of channels out (destination channels)"
          small={true}
          withControls={true}
          min={1}
          onChange={channelsOut => update(mixer => mixer.channels.out = channelsOut)}/>
    </div>
    <ErrorMessage message={errors({path: ['channels']})}/>
    <ErrorMessage message={errors({path: ['channels', 'in']})}/>
    <ErrorMessage message={errors({path: ['channels', 'out']})}/>
    {mixer.mapping.map((mapping, index) =>
        <MappingView
            key={index}
            mapping={mapping}
            errors={errorsForSubpath(errors, 'mapping', index)}
            channels={mixer.channels}
            update={mappingUpdate => update(mixer => mappingUpdate(mixer.mapping[index]))}
            remove={() => update(mixer => mixer.mapping.splice(index, 1))}
            input_labels={input_labels}
            output_labels={mixer.labels}/>
    )}
    <div className="vertically-spaced-content">
    <div style={{display: 'flex', justifyContent: 'left'}}>
      {mixer.mapping.length < mixer.channels.out &&
        <AddButton
            tooltip="Add a mapping"
            style={{marginTop: '10px'}}
            onClick={() => update(mixer => mixer.mapping.push(defaultMapping(mixer.channels.out, mixer.mapping)))}/>
      }
      </div>
      <OptionalTextInput
        placeholder="description"
        value={mixer.description}
        tooltip="Mixer description"
        onChange={desc => update(mixer => mixer.description = desc)}/>
      <StringListOption // TODO copy from devices tab
        value={mixer.labels}
        error={errors({path: ['labels']})}
        desc="labels"
        tooltip="Labels for channels"
        onChange={labels => update(mixer => mixer.labels = labels)}/>
    </div>
  </Box>
}

function MappingView(props: {
  mapping: Mapping
  errors: ErrorsForPath
  channels: { in: number, out: number }
  remove: () => void
  update: (update: Update<Mapping>) => void
  input_labels: (string|null)[] | null
  output_labels: (string|null)[] | null
}) {
  const {mapping, errors, channels, remove, update, input_labels, output_labels} = props
  return <Box style={{marginTop: '5px'}} title={
    <>
      <IntOption
          value={mapping.dest}
          desc="destination"
          tooltip="Destination channel number"
          small={true}
          withControls={true}
          min={0}
          max={channels.out-1}
          onChange={dest => update(mapping => mapping.dest = dest)}/>
      <div  style={{width: 'fit-content'}}>
        {getLabelForChannel(output_labels, mapping.dest)}
      </div>
      <MdiButton
          icon={mdiVolumeOff}
          tooltip={"Mute this destination channel"}
          buttonSize="small"
          highlighted={mapping.mute}
          onClick={() => update(mapping => mapping.mute = !mapping.mute)}/>
      <DeleteButton
          tooltip="Delete this mapping"
          smallButton={true}
          onClick={remove}/>
    </>
  }>
    <ErrorMessage message={errors({path: ['dest']})}/>
    <ErrorMessage message={errors({path: ['mute']})}/>
    <ErrorMessage message={errors({path: []})}/>
    <ErrorMessage message={errors({path: ['sources']})}/>
    <div style={{display: 'flex', flexDirection: 'column'}}>
      {mapping.sources.map((source, index) =>
          <React.Fragment key={index}>
            <SourceView
                source={source}
                errors={errorsForSubpath(errors, 'sources', index)}
                channelsIn={channels.in}
                update={updateSource => update(mixer => updateSource(mixer.sources[index]))}
                remove={() => update(mixer => mixer.sources.splice(index, 1))}
                input_labels={input_labels}/>
            {index+1 < mapping.sources.length && <hr/>}
          </React.Fragment>
      )}
      <div>
        <AddButton
            tooltip="Add a source to this mapping"
            onClick={() => update(mapping => mapping.sources.push(defaultSource(channels.in, mapping.sources)))}/>
      </div>
    </div>
  </Box>
}

function SourceView(props: {
  source: Source
  errors: ErrorsForPath
  channelsIn: number
  update: (update: Update<Source>) => void
  remove: () => void
  input_labels: (string|null)[] | null
}) {
  const {source, errors, channelsIn, update, remove, input_labels} = props
  return <>
    <div className="horizontally-spaced-content">
      <div style={{flexGrow: 1}}>
        <IntOption
            value={source.channel}
            desc="source"
            tooltip="Source channel number"
            small={true}
            withControls={true}
            min={0}
            max={channelsIn - 1}
            onChange={channel => update(source => source.channel = channel)}/>
      </div>
      <div style={{width: 'fit-content'}}>
        {getLabelForChannel(input_labels, source.channel)}
      </div>
      <div style={{flexGrow: 1}}>
        <FloatOption
            value={source.gain ? source.gain : 0.0}
            desc="gain"
            tooltip="Gain in dB for this source channel"
            onChange={gain => update(source => source.gain = gain)}/>
      </div>
      <div style={{flexGrow: 1}}>
        <OptionalEnumOption
            value= {source.scale}
            error={errors({path: ['scale']})}
            options={GainScales}
            desc="scale"
            tooltip="Scale for gain"
            onChange={scale => update(source => source.scale = scale )}/>
      </div>
      <MdiButton
          icon={mdiPlusMinusVariant}
          tooltip={"Invert this source channel"}
          buttonSize="small"
          highlighted={source.inverted}
          onClick={() => update(source => source.inverted = !source.inverted)}/>
      <MdiButton
          icon={mdiVolumeOff}
          tooltip={"Mute this source channel"}
          buttonSize="small"
          highlighted={source.mute}
          onClick={() => update(source => source.mute = !source.mute)}/>
      <DeleteButton tooltip="Delete this source" smallButton={true} onClick={remove}/>
    </div>
    <ErrorMessage message={errors({path: [], includeChildren: true})}/>
  </>
}