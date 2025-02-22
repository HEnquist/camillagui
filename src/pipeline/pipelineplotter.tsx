import Popup from "reactjs-popup"
import 'reactjs-popup/dist/index.css'
import * as d3 from "d3"
import React, { useCallback, useState } from "react"
import "../index.css"
import { CloseButton, cssStyles } from "../utilities/ui-components"
import { CaptureDevice, Config, PlaybackDevice, getCaptureDeviceChannelCount, getLabelForChannel, Source } from "../camilladsp/config"
import { mdiImage, mdiArrowExpandHorizontal, mdiArrowCollapseHorizontal, mdiArrowExpandAll } from "@mdi/js"
import { MdiButton } from "../utilities/ui-components"
import { Range } from "immutable"

export function PipelinePopup(props: {
  config: Config,
  open: boolean,
  onClose: () => void
}) {
  const [expandFiltersteps, setExpandFiltersteps] = useState(true);
  const [expandVertical, setExpandVertical] = useState(false);
  const downloadSvg = useCallback(() => {
    var svg = document.getElementById("svg_pipeline");
    if (svg !== null) {
      var serializer = new XMLSerializer();
      var source = '<?xml version="1.0" standalone="no"?>\r\n' + serializer.serializeToString(svg);
      var url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(source);
      const link = document.createElement('a')
      link.download = "pipeline.svg"
      link.href = url
      link.click()
    }
  }, [])
  const toggleExpandFiltersteps = () => setExpandFiltersteps(!expandFiltersteps)
  const toggleExpandVertical = () => setExpandVertical(!expandVertical)
  return <Popup
    open={props.open}
    closeOnDocumentClick
    onClose={props.onClose}
    contentStyle={{ width: '90%' }}
  >
    <CloseButton onClick={props.onClose} />
    <PipelinePlot config={props.config} expand_filters={expandFiltersteps} expand_vertical={expandVertical} />
    <MdiButton
      icon={mdiImage}
      tooltip="Save plot as image"
      onClick={downloadSvg} />
    <MdiButton
      icon={expandFiltersteps ? mdiArrowCollapseHorizontal : mdiArrowExpandHorizontal}
      tooltip={expandFiltersteps ? "Collapse individual filters into filter steps" : "Expand filter steps to individual filters"}
      onClick={toggleExpandFiltersteps} />
    <MdiButton
      icon={mdiArrowExpandAll}
      tooltip={"Reset zoom to display entire plot"}
      onClick={toggleExpandVertical} />
  </Popup>

}



interface Rect {
  x: number
  y: number
  width: number
  height: number
  radius: number
  fill: string
  stroke: string
  "stroke-width": number
  tooltip: string | null
}

interface Text {
  x: number
  y: number
  text: string
  fill: string
  size: number
  angle: number
}

interface Link {
  source: number[]
  target: number[]
  color: string
}

interface Point {
  x: number
  y: number
}

interface Block {
  input: Point
  output: Point
}

type Props = {
  config: Config,
  expand_filters: boolean,
  expand_vertical: boolean,
}

type State = {
  width: number,
  height: number,
  capture_channels: number,
  zoomTransform: any
}

class PipelinePlot extends React.Component<Props, State> {

  private width = 1400
  private height = 900

  private textColor?: string
  private borderColor?: string
  private arrowColors: string[]
  private backgroundColor?: string
  private frameBgColor?: string
  private blockBgColor?: string
  private disabledBlockBgColor?: string
  private blockTextColor?: string
  private disabledBlockTextColor?: string
  private node?: any
  private zoom: any
  private tooltip: any

  constructor(props: Props) {
    super(props)
    this.arrowColors = []
    this.state = { height: this.height, width: this.width, capture_channels: 2, zoomTransform: null}
    this.zoom = d3.zoom().scaleExtent([0.25, 10]).on("zoom", this.zoomed.bind(this));
  }

  componentDidMount() {
    const styles = cssStyles()
    this.textColor = styles.getPropertyValue('--text-color')
    this.borderColor = styles.getPropertyValue('--box-border-color')
    this.arrowColors = styles.getPropertyValue('--arrow-colors').split(',').map(c => c.trim());
    this.backgroundColor = styles.getPropertyValue('--background-color')
    this.frameBgColor = styles.getPropertyValue('--frame-background-color')
    this.blockBgColor = styles.getPropertyValue('--block-background-color')
    this.disabledBlockBgColor = styles.getPropertyValue('--disabled-block-background-color')
    this.blockTextColor = styles.getPropertyValue('--block-text-color')
    this.disabledBlockTextColor = styles.getPropertyValue('--disabled-block-text-color')
    getCaptureDeviceChannelCount(this.props.config.devices.capture).then(channels => {
      this.setState({ capture_channels: channels })
    })
    this.createPipelinePlot()
    d3.select('#svg_pipeline_div').call(this.zoom);

    // A div used to display tooltips
    this.tooltip = d3.select(`#svg_pipeline_div`).append("div")
        .attr("class", "pipeline-tooltip")
        .style("opacity", 0)
        .style("z-index", "100")
        .style("position", "fixed")
        .style("user-select", "none")
  }

  componentDidUpdate(prevProps: Readonly<Props>, prevState: Readonly<State>, snapshot?: any) {
    if (this.props.expand_vertical !== prevProps.expand_vertical) {
      this.resetZoom()
    }
    if (this.state.width !== prevState.width ||
      this.state.height !== prevState.height ||
      this.props.expand_filters !== prevProps.expand_filters ||
      this.state.capture_channels !== prevState.capture_channels ||
      this.state.zoomTransform !== prevState.zoomTransform
    ) {
      this.createPipelinePlot()
    }
  }

  zoomed(event: any) {
    this.setState({
      zoomTransform: event.transform,
    });
  }

  resetZoom() {
    d3.select('#svg_pipeline_div').transition().duration(500).call(this.zoom.transform, d3.zoomIdentity)
  }

  private appendBlock(labels: Text[], boxes: Rect[], label: string, tooltip: string | null, x: number, y: number, width: number, disabled: boolean): Block {
    const rect = {
      x: x - 0.5 * width,
      y: y - 0.35,
      width: width,
      height: 0.7,
      radius: 0.1,
      fill: disabled ? this.disabledBlockBgColor! : this.blockBgColor!,
      stroke: this.borderColor!,
      "stroke-width": 1,
      tooltip: tooltip
    }
    let label_size = 0.25
    if (label.length > 30)
      label_size = 0.10
    else if (label.length > 20)
      label_size = 0.13
    else if (label.length > 15)
      label_size = 0.20
    const text = {
      x: x,
      y: y + 0.1,
      text: label,
      fill: disabled ? this.disabledBlockTextColor! : this.blockTextColor!,
      size: label_size,
      angle: 0,
    }
    labels.push(text)
    boxes.push(rect)
    return {
      output: { x: x + 0.5 * width, y: y },
      input: { x: x - 0.5 * width, y: y },
    }
  }

  private appendFrame(labels: Text[], boxes: Rect[], label: string, x: number, y: number, width: number, height: number) {
    const rect = {
      x: x - 0.5 * width,
      y: -height / 2 + y,
      width: width,
      height: height,
      radius: 0.15,
      fill: this.frameBgColor!,
      stroke: this.borderColor!,
      "stroke-width": 1,
      tooltip: null
    }
    let label_size = 0.25
    if (label.length > 40)
      label_size = 0.15
    else if (label.length > 30)
      label_size = 0.17
    else if (label.length > 20)
      label_size = 0.22
    const text = {
      x: x,
      y: -height / 2 - 0.2 + y,
      text: label,
      fill: this.textColor!,
      size: label_size,
      angle: 0,
    }
    labels.push(text)
    boxes.push(rect)
  }

  private fillBackground(boxes: Rect[], x: number, y: number, width: number, height: number) {
    const rect = {
      x: x,
      y: y,
      width: width,
      height: height,
      radius: 0,
      fill: this.backgroundColor!,
      stroke: this.backgroundColor!,
      "stroke-width": 0,
      tooltip: null
    }
    boxes.unshift(rect)
  }

  private appendLink(links: Link[], labels: Text[], source: Point, dest: Point, channel: number, label?: string) {
    const colorIndex = channel % this.arrowColors.length
    const arrowColor = this.arrowColors[colorIndex]
    const newlink = {
      source: [source.x, source.y],
      target: [dest.x, dest.y],
      color: arrowColor
    }
    if (label) {
      const position = dest.y <= source.y ?
        {
          x: (2 * source.x) / 3 + dest.x / 3,
          y: (2 * source.y) / 3 + dest.y / 3,
        }
        : {
          x: source.x / 3 + (2 * dest.x) / 3,
          y: source.y / 3 + (2 * dest.y) / 3,
        }
      const text = {
        ...position,
        text: label,
        fill: this.textColor!,
        size: 0.2,
        angle: 180 / 3.14 * Math.atan(1.5 * (dest.y - source.y) / (dest.x - source.x)),
      }
      labels.push(text)
    }
    links.push(newlink)
  }

  private static deviceText(device: CaptureDevice | PlaybackDevice): string {
    if ('device' in device)
      return device.device === null ? "default" : device.device
    else if ('filename' in device)
      return device.filename
    else
      return device.type
  }

  private mixerGainText(src: Source, is_muted: boolean): string {
    if (src.mute === true || is_muted) {
      return "muted"
    }
    if (src.gain === null) {
      return ''
    }
    let label = src.gain.toString()
    if (src.scale === 'linear') {
      label = "\u00D7 " + label
    }
    else {
      label = label + " dB"
    }
    if (src.inverted) {
      label = label + " inv."
    }
    return label
  }

  private makeShapes(conf: Config, expand_filters: boolean) {
    const spacing_h = 3
    const spacing_v = 1
    let max_v: number
    let max_h: number = 1
    const labels: Text[] = []
    const boxes: Rect[] = []
    const links: Link[] = []
    const stages = []
    const channels = []
    const capture = conf["devices"]["capture"]
    let active_channels = this.state.capture_channels
    let channel_labels = []
    const capturename = PipelinePlot.deviceText(capture)
    this.appendFrame(
      labels,
      boxes,
      capturename,
      0,
      0,
      1.5,
      spacing_v * active_channels,
    )
    let cap_params = conf.devices.capture
    let cap_tooltip = "<strong>Capture device</strong>"
    for (const [key, value] of Object.entries(cap_params)) {
      cap_tooltip = cap_tooltip + "<br>" + key + ": " + value
    }
    for (let n = 0; n < active_channels; n++) {
      const labels = cap_params.labels
      channel_labels.push(getLabelForChannel(labels, n))
    }
    for (let n = 0; n < active_channels; n++) {
      var label = channel_labels[n]
      const io_points = this.appendBlock(
        labels,
        boxes,
        label,
        cap_tooltip,
        0,
        spacing_v * (-active_channels / 2 + 0.5 + n),
        1,
        false
      )
      channels.push([io_points])
    }
    stages.push(channels)
    max_v = active_channels / 2 + 1

    // loop through pipeline
    let total_length = 0
    let stage_start = 0

    // resampler
    if (conf.devices.resampler !== null && conf.devices.resampler !== undefined) {
      total_length += 1
      let resampler_channels = []
      this.appendFrame(
        labels,
        boxes,
        "Resampler",
        spacing_h * total_length,
        0,
        1.5,
        spacing_v * active_channels,
      )
      let res_params = conf.devices.resampler
      let res_tooltip = "<strong>Resampler</strong>"
      for (const [key, value] of Object.entries(res_params)) {
        res_tooltip = res_tooltip + "<br>" + key + ": " + value
      }
      for (let n = 0; n < active_channels; n++) {
        const label = channel_labels[n]
        const io_points = this.appendBlock(
          labels,
          boxes,
          label,
          res_tooltip,
          spacing_h * total_length,
          spacing_v * (-active_channels / 2 + 0.5 + n),
          1,
          false
        )
        resampler_channels.push([io_points])
        const src_p = stages[0][n][0].output
        const dest_p = io_points.input
        this.appendLink(links, labels, src_p, dest_p, n)
      }
      stages.push(resampler_channels)
      stage_start = total_length
    }

    // volume control
    total_length += 1
    let vol_channels = []
    this.appendFrame(
      labels,
      boxes,
      "Volume",
      spacing_h * total_length,
      0,
      1.5,
      spacing_v * active_channels,
    )
    for (let n = 0; n < active_channels; n++) {
      const label = channel_labels[n]
      const io_points = this.appendBlock(
        labels,
        boxes,
        label,
        "Default volume control",
        spacing_h * total_length,
        spacing_v * (-active_channels / 2 + 0.5 + n),
        1,
        false
      )
      vol_channels.push([io_points])
      const src_p = stages[total_length-1][n][0].output
      const dest_p = io_points.input
      this.appendLink(links, labels, src_p, dest_p, n)
    }
    stages.push(vol_channels)
    stage_start = total_length

    const pipeline = conf.pipeline ? conf.pipeline : []
    for (let n = 0; n < pipeline.length; n++) {
      const step = pipeline[n]
      const disabled = step.bypassed === true
      if (step.type === "Mixer" && conf.mixers) {
        total_length += 1
        const mixername = step.name
        const mixconf = conf["mixers"][mixername]
        if (active_channels !== mixconf.channels.in && !disabled) {
          console.log("Invalid config, unable to complete plot")
          return { labels, boxes, links, max_h, max_v }
        }
        if (!disabled) {
          active_channels = mixconf.channels.out
        }
        const mixerchannels: Block[][] = []
        this.appendFrame(
          labels,
          boxes,
          mixername,
          spacing_h * total_length,
          0,
          1.5,
          spacing_v * mixconf.channels.out
        )
        channel_labels = []
        for (let n = 0; n < mixconf.channels.out; n++) {
          label = getLabelForChannel(mixconf.labels, n)
          channel_labels.push(label)
        }
        for (let m = 0; m < mixconf.channels.out; m++) {
          mixerchannels.push([])
          const label = channel_labels[m]
          const io_points = this.appendBlock(
            labels,
            boxes,
            label,
            null,
            total_length * spacing_h,
            spacing_v * (-mixconf.channels.out / 2 + 0.5 + m),
            1,
            disabled
          )
          mixerchannels[m].push(io_points)
        }
        if (!disabled) {
          for (let m = 0; m < mixconf.mapping.length; m++) {
            const mapping = mixconf.mapping[m]
            const dest_ch = mapping.dest
            const mapping_muted = mapping.mute === true
            for (let p = 0; p < mapping.sources.length; p++) {
              const src = mapping.sources[p]
              const src_ch = src.channel
              const muted = src.mute === true || mapping_muted
              const label = this.mixerGainText(src, muted)
              const srclen = stages[stages.length - 1][src_ch].length
              const src_p = stages[stages.length - 1][src_ch][srclen - 1].output
              const dest_p = mixerchannels[dest_ch][0].input
              this.appendLink(links, labels, src_p, dest_p, src_ch, label)
            }
          }
          stages.push(mixerchannels)
        }
        stage_start = total_length
        max_v = Math.max(max_v, active_channels / 2 + 1)
      } else if (step.type === "Processor" && conf.processors) {
        total_length += 1
        const procname = step.name
        const procconf = conf["processors"][procname]
        const procchannels: Block[][] = []
        if (active_channels !== procconf.parameters.channels && !disabled) {
          console.log("Invalid config, unable to plot")
          return { labels, boxes, links, max_h, max_v }
        }
        this.appendFrame(
          labels,
          boxes,
          procname,
          spacing_h * total_length,
          0,
          1.5,
          spacing_v * active_channels
        )
        for (let m = 0; m < active_channels; m++) {
          procchannels.push([])
          let label = m.toString()
          if (procconf.type === "Compressor") {
            const is_m = procconf.parameters.monitor_channels === null || procconf.parameters.monitor_channels.includes(m)
            const is_p = procconf.parameters.process_channels === null || procconf.parameters.process_channels.includes(m)
            if (is_m && is_p) {
              label = label + ": M+P"
            }
            else if (is_m) {
              label = label + ": M"
            }
            else if (is_p) {
              label = label + ": P"
            }
            else {
              label = label + ": pass"
            }
          }
          const io_points = this.appendBlock(
            labels,
            boxes,
            label,
            null,
            total_length * spacing_h,
            spacing_v * (-active_channels / 2 + 0.5 + m),
            1,
            disabled
          )
          procchannels[m].push(io_points)
        }
        if (!disabled) {
          for (let m = 0; m < active_channels; m++) {
            const srclen = stages[stages.length - 1][m].length
            const src_p = stages[stages.length - 1][m][srclen - 1].output
            const dest_p = procchannels[m][0].input
            this.appendLink(links, labels, src_p, dest_p, m)
          }
          stages.push(procchannels)
        }
        stage_start = total_length
        max_v = Math.max(max_v, active_channels / 2 + 1)
      } else if (step.type === "Filter") {
        let _channels = step.channels
        if (_channels === null) {
          _channels = Array.from(Range(0, active_channels))
        }
        for (const ch_nbr of _channels) {
          if (ch_nbr >= active_channels && !disabled) {
            console.log("Invalid config, unable to plot")
            return { labels, boxes, links, max_h, max_v }
          }
          if (expand_filters) {
            for (let m = 0; m < step.names.length; m++) {
              const name = step.names[m]
              let params = conf.filters ? conf.filters[name] : null
              let tooltip = "<strong>Filter</strong>"
              if (params !== null) {
                for (const [key, value] of Object.entries(params)) {
                  if (key !== "parameters") {
                    tooltip = tooltip + "<br>" + key + ": " + value
                  }
                }
                if (params.hasOwnProperty("parameters")) {
                  let fparams = params.parameters
                  tooltip = tooltip + "<br>parameters:"
                  for (const [key, value] of Object.entries(fparams)) {
                    tooltip = tooltip + "<br>  " + key + ": " + value
                  }
                }
              }
              let ch_step: number
              if (ch_nbr < stages[stages.length - 1].length) {
                ch_step = stage_start + stages[stages.length - 1][ch_nbr].length
              } else {
                ch_step = stage_start + stages[stages.length - 1][0].length
              }
              total_length = Math.max(total_length, ch_step)
              const io_points = this.appendBlock(
                labels,
                boxes,
                name,
                tooltip,
                ch_step * spacing_h,
                spacing_v * (-active_channels / 2 + 0.5 + ch_nbr),
                2.5,
                disabled
              )
              if (!disabled) {
                const src_list = stages[stages.length - 1][ch_nbr]
                const src_p = src_list[src_list.length - 1].output
                const dest_p = io_points.input
                stages[stages.length - 1][ch_nbr].push(io_points)
                this.appendLink(links, labels, src_p, dest_p, ch_nbr)
              }
            }
          }
          else {
            let name = "(empty)"
            let tooltip = "Filters:"
            if (step.description) {
              tooltip = step.description + '<br><br>' + tooltip
              if (step.description.length > 50) {
                name = step.description.slice(0, 47) + '...'
              }
              else {
                name = step.description
              }
            }
            else if (step.names.length > 0) {
              name = step.names[0]
              if (step.names.length > 1) {
                name = name + " (+" + (step.names.length - 1) + ")"
              }
            }
            for (const filtname of step.names) {
              tooltip = tooltip + "<br> - " + filtname
            }
            let ch_step: number
            if (ch_nbr < stages[stages.length - 1].length) {
              ch_step = stage_start + stages[stages.length - 1][ch_nbr].length
            } else {
              ch_step = stage_start + stages[stages.length - 1][0].length
            }
            total_length = Math.max(total_length, ch_step)
            this.appendBlock(
              labels,
              boxes,
              "",
              null,
              ch_step * spacing_h - 0.04,
              spacing_v * (-active_channels / 2 + 0.5 + ch_nbr) - 0.06,
              2.5,
              disabled
            )
            const io_points = this.appendBlock(
              labels,
              boxes,
              name,
              tooltip,
              ch_step * spacing_h,
              spacing_v * (-active_channels / 2 + 0.5 + ch_nbr),
              2.5,
              disabled
            )
            if (!disabled) {
              const src_list = stages[stages.length - 1][ch_nbr]
              const src_p = src_list[src_list.length - 1].output
              const dest_p = io_points.input
              stages[stages.length - 1][ch_nbr].push(io_points)
              this.appendLink(links, labels, src_p, dest_p, ch_nbr)
            }
          }
        }
      }
    }
    const playbackchannels = []
    total_length = total_length + 1
    max_h = (total_length + 1) * spacing_h
    const playbackname = PipelinePlot.deviceText(conf.devices.playback)
    this.appendFrame(
      labels,
      boxes,
      playbackname,
      spacing_h * total_length,
      0,
      1.5,
      spacing_v * active_channels
    )
    let pb_params = conf.devices.playback
    let pb_tooltip = "<strong>Playback device</strong>"
    for (const [key, value] of Object.entries(pb_params)) {
      pb_tooltip = pb_tooltip + "<br>" + key + ": " + value
    }
    for (let n = 0; n < active_channels; n++) {
      const label = channel_labels[n]
      const io_points = this.appendBlock(
        labels,
        boxes,
        label,
        pb_tooltip,
        spacing_h * total_length,
        spacing_v * (-active_channels / 2 + 0.5 + n),
        1,
        false
      )
      playbackchannels.push([io_points])
      const srclen = stages[stages.length - 1][n].length
      const src_p = stages[stages.length - 1][n][srclen - 1].output
      const dest_p = io_points.input
      this.appendLink(links, labels, src_p, dest_p, n)
    }
    stages.push(playbackchannels)
    return { labels, boxes, links, max_h, max_v }
  }



  createPipelinePlot() {
    d3.select(`#svg_pipeline`).selectAll('*').remove()

    let { labels, boxes, links, max_h, max_v } = this.makeShapes(this.props.config, this.props.expand_filters)
    // if (max_h > (2*this.width/this.height) * max_v)
    //   max_v = max_h / (2*this.width/this.height)
    // else
    //    max_h = (2*this.width/this.height) * max_v

    if (max_h < 10)
      max_h = 10
    if (max_v < 4)
      max_v = 4
    const total_width = max_h + 2.5
    const total_height = 2 * max_v
    const calculated_height = this.width * total_height / total_width
    this.setState({ height: calculated_height, width: this.width })

    this.fillBackground(boxes, -2.5, -max_v, total_width, total_height)

    const node = this.node
    const yScale = d3
      .scaleLinear()
      .domain([-max_v, max_v])
      .range([0, calculated_height])
    const xScale = d3
      .scaleLinear()
      .domain([-2.5, max_h])
      .range([0, this.width])

    const linkGen = d3
      .linkHorizontal()
      .source((d) => [xScale(d.source[0]), yScale(d.source[1])])
      .target((d) => [xScale(d.target[0]), yScale(d.target[1])])

    const markerBoxWidth = 7
    const markerBoxHeight = 7
    const refX = markerBoxWidth
    const refY = markerBoxHeight / 2
    const arrowPoints = [
      [0, 0],
      [0, markerBoxHeight],
      [markerBoxWidth, markerBoxHeight / 2],
    ]
    for (const color of this.arrowColors) {
      d3.select(node)
        .append("defs")
        .append("marker")
        .attr("id", "arrow" + color)
        // @ts-ignore
        .attr("viewBox", [0, 0, markerBoxWidth, markerBoxHeight])
        .attr("refX", refX)
        .attr("refY", refY)
        .attr("markerWidth", markerBoxWidth)
        .attr("markerHeight", markerBoxHeight)
        .attr("orient", "auto-start-reverse")
        .attr("fill", color)
        .attr("stroke", color)
        .append("path")
        // @ts-ignore
        .attr("d", d3.line()(arrowPoints))
    }

    const rects = d3
      .select(node)
      .selectAll("rect")
      .data(boxes)
      .enter()
      .append("rect")
      .attr("transform", this.state.zoomTransform)

    rects
      .attr("x", d => xScale(d.x))
      .attr("y", d => yScale(d.y))
      .attr("rx", d => xScale(d.radius) - xScale(0))
      .attr("ry", d => yScale(d.radius) - yScale(0))
      .attr("width", d => xScale(d.width) - xScale(0))
      .attr("height", d => yScale(d.height) - yScale(0))
      .style("fill", d => d.fill)
      .style("stroke", d => d.stroke)
      .style("stroke-width", d => d["stroke-width"])
      .on("mouseover", (event, d) => {
        if (d.tooltip !== null) {
          // This element has a tooltip, add the content and display the tooltip div.
          this.tooltip.html(d.tooltip)
          this.tooltip.transition()
            .duration(500)
            .style("opacity", .9)
        }
        else {
          // This element does not have a tooltip, hide the tooltip div.
          this.tooltip.transition()
            .duration(500)
            .style("opacity", 0)
        }
      })
      .on("mousemove", (event, d) => {
        // Move the tooltip with the cursor.
        const tt_node = this.tooltip.node()
        const tt_width = tt_node ? tt_node.getBoundingClientRect().width : 0
        const tt_height = tt_node ? tt_node.getBoundingClientRect().height : 0
        console.log(event.pageX, event.pageY)
        this.tooltip
          .style("left", event.pageX - tt_width / 2 + "px")
          .style("top", event.pageY - tt_height - 10 + "px")
      })

    const text = d3
      .select(node)
      .selectAll("text")
      .data(labels)
      .enter()
      .append("text")

    let zoom_k = this.state.zoomTransform ? this.state.zoomTransform.k : 1
    let zoom_x = this.state.zoomTransform ? this.state.zoomTransform.x : 0
    let zoom_y = this.state.zoomTransform ? this.state.zoomTransform.y : 0

    //Add SVG Text Element Attributes
    text
      .text(d => d.text)
      .attr("font-size", d => yScale(d.size) - yScale(0) + "px")
      .attr("fill", d => d.fill)
      .style("text-anchor", "middle")
      .attr("transform", d => (`translate(${zoom_x}, ${zoom_y}), scale(${zoom_k}, ${zoom_k}), translate(${xScale(d.x)},${yScale(d.y)}), rotate(${d.angle})`))
      .attr("font-family", "sans-serif")

    d3.select(node)
      .selectAll(null)
      .data(links)
      .join("path")
      // @ts-ignore
      .attr("d", linkGen)
      .attr("marker-end", d => "url(#arrow" + d.color + ")")
      .attr("fill", "none")
      .attr("stroke", d => d.color)
      .attr("stroke-width", yScale(0.03) - yScale(0) + "px")
      .attr("transform", this.state.zoomTransform)

  }


  render() {
    let x0 = 0
    let y0 = 0
    let width = this.state.width
    let height = this.state.height
    return <div id="svg_pipeline_div" style={{ width: '90vw', height: '80vh', overflowY: 'auto', overflowX: 'auto' }}>
      <svg
        ref={node => this.node = node}
        id="svg_pipeline"
        viewBox={`${x0} ${y0} ${width} ${height}`}
        style={{ height: '99%', width: '100%' }}
      />
    </div>
  }
}