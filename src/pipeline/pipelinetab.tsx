import React, { ReactNode, useState } from "react"
import "../index.css"
import { PipelinePopup } from './pipelineplotter'
import {
  AddButton,
  Box,
  Button,
  DeleteButton,
  EnumInput,
  ERROR_BACKGROUND_STYLE,
  ErrorMessage,
  IntOption,
  MdiButton,
  OptionalBoolOption,
  OptionalTextInput,
  PlotButton
} from "../utilities/ui-components"
import {
  Config,
  defaultFilterStep,
  defaultMixerStep,
  defaultProcessorStep,
  EMPTY,
  filterNamesOf,
  Filters,
  FilterStep,
  maxChannelCount,
  mixerNamesOf,
  Mixers,
  MixerStep,
  Pipeline,
  PipelineStep,
  processorNamesOf,
  Processors,
  ProcessorStep
} from "../camilladsp/config"
import { mdiArrowDownBold, mdiArrowUpBold } from "@mdi/js"
import { ErrorsForPath, errorsForSubpath } from "../utilities/errors"
import { DndContainer, DndSortable, DragHandle, useDndSort } from "../utilities/dragndrop"
import { moveItem, moveItemDown, moveItemUp } from "../utilities/arrays"
import { Update } from "../utilities/common"
import { ChartData, ChartPopup } from "../utilities/chart"
import { Range } from "immutable"

export class PipelineTab extends React.Component<{
  config: Config
  updateConfig: (update: Update<Config>) => void
  errors: ErrorsForPath
}, {
  plotPipeline: boolean
  plotFilterStep: boolean
  stepIndex?: number
  data: ChartData
}> {
  constructor(props: any) {
    super(props)
    this.state = {
      plotPipeline: false,
      plotFilterStep: false,
      data: {
        name: "Pipeline step",
        f: [],
        time: [],
        options: [{ name: "" }]
      }
    }
  }

  updatePipeline = (update: Update<Pipeline>) =>
    this.props.updateConfig(config => {
      if (!config.pipeline) {
        config.pipeline = []
      }
      update(config.pipeline)
    })

  addStep = () =>
    this.updatePipeline(pipeline => pipeline.push(defaultFilterStep(this.props.config)))

  removeStep = (index: number) =>
    this.updatePipeline(pipeline => pipeline.splice(index, 1))

  setStepType = (index: number, type: 'Filter' | 'Mixer' | 'Processor') =>
    this.updatePipeline(pipeline => {
      if (type === 'Mixer')
        pipeline[index] = defaultMixerStep(this.props.config)
      else if (type === 'Filter')
        pipeline[index] = defaultFilterStep(this.props.config)
      else if (type === 'Processor')
        pipeline[index] = defaultProcessorStep(this.props.config)
    })

  plotFilterStep = (index: number, samplerate?: number, channels?: number) => {
    const config = this.props.config
    fetch("/api/evalfilterstep", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        index: index,
        config: config,
        samplerate: samplerate || config.devices.samplerate,
        channels: channels || config.devices.capture.channels
      }),
    }).then(
      result => result.json()
        .then(data => this.setState({ plotFilterStep: true, stepIndex: index, data: data })),
      error => console.log("Failed", error)
    )
  }

  moveStepUp = (index: number) =>
    this.updatePipeline(pipeline => moveItemUp(pipeline, index))

  moveStepDown = (index: number) =>
    this.updatePipeline(pipeline => moveItemDown(pipeline, index))

  render() {
    const { config, errors } = this.props
    const pipeline = config.pipeline
    return <DndContainer>
      <div className="tabpanel" style={{ width: '700px' }}>
        <ErrorMessage message={errors({ path: [] })} />
        <div className="pipeline-channel">
          Capture: {config.devices.capture.channels} channels in
        </div>
        {pipeline?.map((step: PipelineStep, index: number) => {
          const stepErrors = errorsForSubpath(errors, index)
          const typeSelect = <EnumInput
            value={step.type}
            options={['Mixer', 'Filter', 'Processor']}
            desc="type"
            data-tip="Step type"
            style={{ marginRight: '15px' }}
            onChange={type => this.setStepType(index, type)} />
          const controls = <>
            <DeleteButton tooltip="Delete this step" onClick={() => this.removeStep(index)} />
            <MdiButton
              icon={mdiArrowUpBold}
              tooltip="Move this step up"
              enabled={index > 0}
              onClick={() => this.moveStepUp(index)} />
            <MdiButton
              icon={mdiArrowDownBold}
              tooltip="Move this step down"
              enabled={index + 1 < pipeline.length}
              onClick={() => this.moveStepDown(index)} />
          </>
          if (step.type === 'Filter')
            return <FilterStepView
              key={index}
              stepIndex={index}
              maxChannelCount={maxChannelCount(config, index)}
              typeSelect={typeSelect}
              filterStep={step}
              filters={config.filters ? config.filters : {}}
              updatePipeline={this.updatePipeline}
              plot={() => this.plotFilterStep(index)}
              errors={stepErrors}
              controls={controls} />
          if (step.type === 'Mixer')
            return <MixerStepView
              key={index}
              stepIndex={index}
              typeSelect={typeSelect}
              mixerStep={step}
              mixers={config.mixers ? config.mixers : {}}
              updatePipeline={this.updatePipeline}
              errors={stepErrors}
              controls={controls} />
          if (step.type === 'Processor')
            return <ProcessorStepView
              key={index}
              stepIndex={index}
              typeSelect={typeSelect}
              processorStep={step}
              processors={config.processors ? config.processors : {}}
              updatePipeline={this.updatePipeline}
              errors={stepErrors}
              controls={controls} />
          else
            return null
        }
        )}
        <div className="horizontally-spaced-content">
          <AddButton tooltip="Add a pipeline step" onClick={this.addStep} />
          <PlotButton tooltip="Plot the pipeline" pipeline={true} onClick={() => this.setState({ plotPipeline: true })} />
        </div>
        <div className="pipeline-channel">
          Playback: {config.devices.playback.channels} channels out
        </div>
        <PipelinePopup
          key={this.state.plotPipeline as any}
          open={this.state.plotPipeline}
          config={config}
          onClose={() => this.setState({ plotPipeline: false })} />
        {this.state.plotFilterStep && <ChartPopup
          key={this.state.plotFilterStep as any}
          open={this.state.plotFilterStep}
          data={this.state.data}
          onChange={name => {
            const current = this.state.data.options.filter(o => o.name === name)[0]
            this.plotFilterStep(this.state.stepIndex!!, current.samplerate, current.channels)
          }}
          onClose={() => this.setState({ plotFilterStep: false })} />}
      </div>
    </DndContainer>
  }
}

function usePipelineStepDndSort(stepIndex: number, updatePipeline: (update: Update<Pipeline>) => void) {
  return useDndSort(
    'step', { stepIndex },
    ({ stepIndex: from }, { stepIndex: to }) => updatePipeline(pipeline => moveItem(pipeline, from, to))
  )
}

function MixerStepView(props: {
  stepIndex: number
  typeSelect: ReactNode
  mixerStep: MixerStep
  mixers: Mixers
  updatePipeline: (update: Update<Pipeline>) => void
  errors: ErrorsForPath
  controls: ReactNode
}) {
  const { stepIndex, typeSelect, mixers, mixerStep, updatePipeline, controls } = props
  const update = (update: Update<MixerStep>) => updatePipeline(pipeline => update(pipeline[stepIndex] as MixerStep))
  const mixer = mixers[mixerStep.name]
  const channelInfo = mixer ?
    <span style={{ marginRight: '15px' }}>{mixer.channels.in}&nbsp;in,&nbsp;{mixer.channels.out}&nbsp;out</span>
    : null
  const options = [EMPTY].concat(mixerNamesOf(mixers))
  const nameError = props.errors({ path: ['name'] })
  const dndProps = usePipelineStepDndSort(stepIndex, updatePipeline)
  return <DndSortable {...dndProps}>
    <Box title={
      <>
        <DragHandle drag={dndProps.drag} tooltip="Drag mixer to change order" />
        {typeSelect}
        {channelInfo}
        <OptionalBoolOption
          value={mixerStep.bypassed}
          desc="bypassed"
          data-tip="Bypass this pipeline step"
          onChange={bp => update(step => step.bypassed = bp)} />
      </>
    }>
      <div className="vertically-spaced-content">
        <ErrorMessage message={props.errors({ path: [] })} />
        <ErrorMessage message={props.errors({ path: ['type'] })} />
        <EnumInput
          value={mixerStep.name}
          options={options}
          desc="name"
          data-tip="Mixer name"
          style={nameError ? ERROR_BACKGROUND_STYLE : undefined}
          onChange={name => update(step => step.name = name)} />
        <ErrorMessage message={nameError} />
        <div className="horizontally-spaced-content">{controls}</div>
        <OptionalTextInput
          placeholder="description"
          value={mixerStep.description}
          data-tip="Pipeline step description"
          onChange={desc => update(step => step.description = desc)} />
      </div>
    </Box>
  </DndSortable>
}

function ProcessorStepView(props: {
  stepIndex: number
  typeSelect: ReactNode
  processorStep: ProcessorStep
  processors: Processors
  updatePipeline: (update: Update<Pipeline>) => void
  errors: ErrorsForPath
  controls: ReactNode
}) {
  const { stepIndex, typeSelect, processors, processorStep, updatePipeline, controls } = props
  const update = (update: Update<ProcessorStep>) => updatePipeline(pipeline => update(pipeline[stepIndex] as ProcessorStep))
  const options = [EMPTY].concat(processorNamesOf(processors))
  const nameError = props.errors({ path: ['name'] })
  const dndProps = usePipelineStepDndSort(stepIndex, updatePipeline)
  return <DndSortable {...dndProps}>
    <Box title={
      <>
        <DragHandle drag={dndProps.drag} tooltip="Drag mixer to change order" />
        {typeSelect}
        <OptionalBoolOption
          value={processorStep.bypassed}
          desc="bypassed"
          data-tip="Bypass this pipeline step"
          onChange={bp => update(step => step.bypassed = bp)} />
      </>
    }>
      <div className="vertically-spaced-content">
        <ErrorMessage message={props.errors({ path: [] })} />
        <ErrorMessage message={props.errors({ path: ['type'] })} />
        <EnumInput
          value={processorStep.name}
          options={options}
          desc="name"
          data-tip="Processor name"
          style={nameError ? ERROR_BACKGROUND_STYLE : undefined}
          onChange={name => update(step => step.name = name)} />
        <ErrorMessage message={nameError} />
        <div className="horizontally-spaced-content">{controls}</div>
        <OptionalTextInput
          placeholder="description"
          value={processorStep.description}
          data-tip="Pipeline step description"
          onChange={desc => update(step => step.description = desc)} />
      </div>
    </Box>
  </DndSortable>
}

function FilterStepView(props: {
  stepIndex: number
  maxChannelCount: number
  typeSelect: ReactNode
  filterStep: FilterStep
  filters: Filters
  updatePipeline: (update: Update<Pipeline>) => void
  plot: () => void
  errors: ErrorsForPath
  controls: ReactNode
}) {
  const {
    stepIndex, typeSelect, filterStep, filters, updatePipeline, plot, controls, maxChannelCount
  } = props
  const options = [EMPTY].concat(filterNamesOf(filters))
  const update = (update: Update<FilterStep>) => updatePipeline(pipeline => update(pipeline[stepIndex] as FilterStep))
  const addFilter = () => update(step => step.names.push(options[0]))
  const moveFilterUp = (index: number) => update(step => moveItemUp(step.names, index))
  const moveFilterDown = (index: number) => update(step => moveItemDown(step.names, index))
  const moveFilter = (fromStep: number, fromIndex: number, toStep: number, toIndex: number) =>
    update(step => {
      if (fromStep === toStep)
        moveItem(step.names, fromIndex, toIndex)
      else {
        updatePipeline(pipeline => {
          const from = pipeline[fromStep] as FilterStep
          const filter = from.names.splice(fromIndex, 1)
          const to = pipeline[toStep] as FilterStep
          to.names.splice(toIndex, 0, ...filter)
        })
      }
    }
    )
  const dndProps = usePipelineStepDndSort(stepIndex, updatePipeline)
  const title = <>
    <DragHandle drag={dndProps.drag} tooltip="Drag filter step to change order" />
    {typeSelect}
    <ChannelSelection
      channels={filterStep.channels}
      maxChannelCount={maxChannelCount}
      setChannels={channels => update(step => step.channels = channels)} />
    <OptionalBoolOption
      value={filterStep.bypassed}
      desc="bypassed"
      data-tip="Bypass this pipeline step"
      onChange={bp => update(step => step.bypassed = bp)} />
  </>
  return <DndSortable {...dndProps}>
    <Box title={title}>
      <div className="vertically-spaced-content">
        <ErrorMessage message={props.errors({ path: ['type'] })} />
        <ErrorMessage message={props.errors({ path: ['channel'] })} />
        <ErrorMessage message={props.errors({ path: [] })} />
        <div className="vertically-spaced-content">

          {filterStep.names.map((name, index) =>
            <FilterStepFilter
              stepIndex={stepIndex}
              key={index}
              index={index}
              name={name}
              options={options}
              setName={filterName => update(step => step.names[index] = filterName)}
              moveFilter={moveFilter}
              errors={props.errors({ path: ['names', index] })}
              controls={
                <>
                  <MdiButton
                    icon={mdiArrowUpBold}
                    tooltip="Move filter up"
                    buttonSize="small"
                    enabled={index > 0}
                    onClick={() => moveFilterUp(index)} />
                  <MdiButton
                    icon={mdiArrowDownBold}
                    tooltip="Move filter down"
                    buttonSize="small"
                    enabled={index + 1 < filterStep.names.length}
                    onClick={() => moveFilterDown(index)} />
                  <DeleteButton
                    tooltip="Remove this filter from the list"
                    smallButton={true}
                    onClick={() => update(step => step.names.splice(index, 1))} />
                </>
              }
            />
          )}

        </div>
        <ErrorMessage message={props.errors({ path: ['names'] })} />
        <div className="horizontally-spaced-content">
          {controls}
          <AddButton tooltip="Add a filter to the list" onClick={addFilter} />
          <PlotButton tooltip="Plot response of this step" onClick={plot} />
        </div>
        <OptionalTextInput
          placeholder="description"
          value={filterStep.description}
          data-tip="Pipeline step description"
          onChange={desc => update(step => step.description = desc)} />
      </div>
    </Box>
  </DndSortable>
}

function ChannelSelection(props: {
  channels: number[] | null
  maxChannelCount: number
  setChannels: (channels: number[] | null) => void
}) {
  if (props.channels?.find((ch: number) => ch >= props.maxChannelCount)) {
    props.setChannels(props.channels.filter((ch: number) => ch < props.maxChannelCount))
  }
  //const simpleUiLimit = 10 //with maxChannelCount below the limit, a more intuitive UI is shown
  //return props.maxChannelCount > simpleUiLimit ?
  //    <TextBasedChannelSelection {...props}/>
  //    : <ButtonBasedChannelSelection {...props}/>
  return <ButtonBasedChannelSelection {...props} />
}

function ButtonBasedChannelSelection(props: {
  channels: number[] | null
  maxChannelCount: number
  setChannels: (channels: number[] | null) => void
}) {
  const { channels, maxChannelCount, setChannels } = props
  let [expanded, setExpanded] = useState(false)

  var _channels = channels
  const toggleAllChannels = () => {
    if (_channels === null) {
      _channels = []
    }
    else {
      _channels = null
    }
    setChannels(_channels)
  }
  const toggleChannel = (idx: number) => {
    if (_channels === null) {
      _channels = []
    }
    if (!_channels.includes(idx)) {
      _channels.push(idx)
    }
    else {
      _channels = _channels.filter((n: number) => n !== idx)
    }
    setChannels(_channels)
  }
  const toggleExpanded = () => {
    setExpanded(!expanded)
  }

  const rows = Math.floor(maxChannelCount / 10) + 1

  if (rows == 1) {
    return <div style={{ marginRight: '10px', display: 'flex', flexDirection: 'row', alignItems: 'last baseline' }}>
      <span style={{ marginRight: '5px' }}>channel</span>
      <ChannelButton key={-1} channel='all' selected={channels === null} onClick={toggleAllChannels} />
      {Range(0, maxChannelCount).map(index =>
        <ChannelButton key={index} channel={index} selected={channels !== null && channels.includes(index)} onClick={() => toggleChannel(index)} />
      )}
    </div>
  }
  else {
    // TODO math last row
    // container
    // positioning
    
    return <div style={{ marginRight: '10px', display: 'flex', flexDirection: 'row', alignItems: 'last baseline' }}>
      <span style={{ marginRight: '5px' }}>channel</span>
      <ChannelButton key={-1} channel='all' selected={channels === null} onClick={toggleAllChannels} />
      <ChannelButton key={0} channel='▼' selected={expanded} onClick={toggleExpanded} />
      {expanded ? <div className="popup-content" title='channels' style={{ position: 'absolute', zIndex: 1, top: '20%', left: '35%' }}><table>{Range(0, rows).map(row => (
        <tr>{Range(0, 10).map(col => (
          <td><ChannelButton key={10 * row + col} channel={10 * row + col} selected={channels !== null && channels.includes(10 * row + col)} onClick={() => toggleChannel(10 * row + col)} /></td>
        ))}</tr>))}</table></div> : <div></div>}
    </div>
  }
}

// {channelNumberTooHigh &&
//   <ChannelButton
//     channel={channel}
//     onClick={() => {
//     }}
//     selected={false}
//     erroneousChannel={channelNumberTooHigh}/>
// }

function ChannelButton(props: {
  channel: number | string
  selected: boolean
  onClick: () => void
  erroneousChannel?: boolean
}) {
  const { channel, selected, onClick, erroneousChannel } = props
  return <Button
    text={channel.toString()}
    onClick={onClick}
    highlighted={selected}
    className='setting-button'
    style={{
      height: '28px',
      marginRight: '5px',
      backgroundColor: erroneousChannel ? 'var(--error-field-background-color)' : undefined
    }}
  />
}

function FilterStepFilter(props: {
  stepIndex: number
  index: number
  options: string[]
  name: string
  setName: (name: string) => void
  moveFilter: (fromStep: number, fromIndex: number, toStep: number, toIndex: number) => void
  errors?: string
  controls: ReactNode
}) {
  const { stepIndex, index, options, name, setName, moveFilter, errors, controls } = props
  const { isDragging, canDrop, drag, preview, drop } = useDndSort(
    'filter',
    { stepIndex, index },
    ({ stepIndex: fromStep, index: fromIndex }, { stepIndex: toStep, index: toIndex }) =>
      moveFilter(fromStep, fromIndex, toStep, toIndex)
  )
  return <DndSortable isDragging={isDragging} canDrop={canDrop} drag={drag} preview={preview} drop={drop}>
    <div className={`horizontally-spaced-content`}>
      <DragHandle drag={drag} tooltip="Drag filter to change order" />
      <EnumInput
        value={name}
        options={options}
        desc={`step${stepIndex}-filter${index}`}
        data-tip="Filter name"
        style={{
          width: '100%',
          ...(errors ? ERROR_BACKGROUND_STYLE : {})
        }}
        onChange={setName} />
      {controls}
    </div>
    <ErrorMessage message={errors} />
  </DndSortable>
}