import Popup from "reactjs-popup"
import 'reactjs-popup/dist/index.css'
import * as d3 from "d3"
import React from "react"
import "../index.css"
import {CloseButton, cssStyles} from "../utilities/common-tsx"
import {CaptureDevice, Config, PlaybackDevice} from "../config"


export function PipelinePopup(props: {
  config: Config,
  open: boolean,
  onClose: () => void
}) {
  return <Popup
      open={props.open}
      closeOnDocumentClick
      onClose={props.onClose}
      contentStyle={{width: '80%'}}
  >
    <CloseButton onClick={props.onClose}/>
    <PipelinePlot config={props.config}/>
  </Popup>
}

interface Rect {
  x: number
  y: number
  width: number
  height: number
  fill: string
  stroke: string
  "stroke-width": number
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
}

interface Point {
  x: number
  y: number
}

interface Block {
  input: Point
  output: Point
}

class PipelinePlot extends React.Component<{config: Config}> {

  private width = 1000
  private height = 500

  private textColor?: string
  private borderColor?: string
  private arrowColor?: string
  private backgroundColor?: string
  private frameBgColor?: string
  private blockBgColor?: string
  private blockTextColor?: string
  private node?: any

  componentDidMount() {
    const styles = cssStyles()
    this.textColor = styles.getPropertyValue('--text-color')
    this.borderColor = styles.getPropertyValue('--box-border-color')
    this.arrowColor = styles.getPropertyValue('--arrow-color')
    this.backgroundColor = styles.getPropertyValue('--background-color')
    this.frameBgColor = styles.getPropertyValue('--frame-background-color')
    this.blockBgColor = styles.getPropertyValue('--block-background-color')
    this.blockTextColor = styles.getPropertyValue('--block-text-color')
    this.createPipelinePlot()
  }

  componentDidUpdate() {
    this.createPipelinePlot()
  }

  private appendBlock(labels: Text[], boxes: Rect[], label: string, x: number, y: number, width: number): Block {
    const rect = {
      x: x - 0.5 * width,
      y: y - 0.35,
      width: width,
      height: 0.7,
      fill: this.blockBgColor!,
      stroke: this.borderColor!,
      "stroke-width": 1,
    }
    const text = {
      x: x,
      y: y + 0.1,
      text: label,
      fill: this.blockTextColor!,
      size: 0.3,
      angle: 0,
    }
    labels.push(text)
    boxes.push(rect)
    return {
      output: { x: x + 0.5 * width, y: y },
      input: { x: x - 0.5 * width, y: y },
    }
  }

  private appendFrame(labels: Text[], boxes: Rect[], label: string, x: number, y: number, width: number, height:number) {
    const rect = {
      x: x - 0.5 * width,
      y: -height / 2 + y,
      width: width,
      height: height,
      fill: this.frameBgColor!,
      stroke: this.borderColor!,
      "stroke-width": 1,
    }
    const text = {
      x: x,
      y: -height / 2 - 0.2 + y,
      text: label,
      fill: this.textColor!,
      size: 0.3,
      angle: 0,
    }
    labels.push(text)
    boxes.push(rect)
  }

  private appendLink(links: Link[], labels: Text[], source: Point, dest: Point, label?: string) {
    const newlink = {
      source: [source.x, source.y],
      target: [dest.x, dest.y]
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
        angle: 1.5 * 180 / 3.14 * Math.atan((dest.y - source.y) / (dest.x - source.x)),
      }
      labels.push(text)
    }
    links.push(newlink)
  }

  private static deviceText(device: CaptureDevice | PlaybackDevice): string {
    if ('device' in device)
      return device.device
    else if ('filename' in device)
      return device.filename
    else
      return device.type
  }

  private makeShapes(conf: Config) {
    const spacing_h = 3
    const spacing_v = 1
    let max_v: number
    const labels: Text[] = []
    const boxes: Rect[] = []
    const links: Link[] = []
    const stages = []
    const channels = []
    const capture = conf["devices"]["capture"]
    let active_channels = capture["channels"]
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
    for (let n = 0; n < active_channels; n++) {
      const label = "ch " + n
      const io_points = this.appendBlock(
        labels,
        boxes,
        label,
        0,
        spacing_v * (-active_channels / 2 + 0.5 + n),
        1
      )
      channels.push([io_points])
    }
    stages.push(channels)
    max_v = active_channels / 2 + 1

    // loop through pipeline
    let total_length = 0
    let stage_start = 0
    for (let n = 0; n < conf.pipeline.length; n++) {
      const step = conf.pipeline[n]
      if (step.type === "Mixer") {
        total_length += 1
        const mixername = step.name
        const mixconf = conf["mixers"][mixername]
        active_channels = mixconf.channels.out
        const mixerchannels: Block[][] = []
        this.appendFrame(
          labels,
          boxes,
          mixername,
          spacing_h * total_length,
          0,
          1.5,
          spacing_v * active_channels
        )
        for (let m = 0; m < active_channels; m++) {
          mixerchannels.push([])
          const label = "ch " + m
          const io_points = this.appendBlock(
            labels,
            boxes,
            label,
            total_length * spacing_h,
            spacing_v * (-active_channels / 2 + 0.5 + m),
            1
          )
          mixerchannels[m].push(io_points)
        }
        for (let m = 0; m < mixconf.mapping.length; m++) {
          const mapping = mixconf.mapping[m]
          const dest_ch = mapping.dest
          for (let p = 0; p < mapping.sources.length; p++) {
            const src = mapping.sources[p]
            const src_ch = src.channel
            const label = src.gain + " dB" + (src.inverted ? " inv." : '')
            const srclen = stages[stages.length - 1][src_ch].length
            const src_p = stages[stages.length - 1][src_ch][srclen - 1].output
            const dest_p = mixerchannels[dest_ch][0].input
            this.appendLink(links, labels, src_p, dest_p, label)
          }
        }
        stages.push(mixerchannels)
        stage_start = total_length
        max_v = Math.max(max_v, active_channels / 2 + 1)
      } else if (step.type === "Filter") {
        const ch_nbr = step.channel
        for (let m = 0; m < step.names.length; m++) {
          const name = step.names[m]
          const ch_step = stage_start + stages[stages.length - 1][ch_nbr].length
          total_length = Math.max(total_length, ch_step)
          const io_points = this.appendBlock(
            labels,
            boxes,
            name,
            ch_step * spacing_h,
            spacing_v * (-active_channels / 2 + 0.5 + ch_nbr),
            2.5
          )
          const src_list = stages[stages.length - 1][ch_nbr]
          const src_p = src_list[src_list.length - 1].output
          const dest_p = io_points.input
          stages[stages.length - 1][ch_nbr].push(io_points)
          this.appendLink(links, labels, src_p, dest_p)
        }
      }
    }
    const playbackchannels = []
    total_length = total_length + 1
    const max_h = (total_length + 1) * spacing_h
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
    for (let n = 0; n < active_channels; n++) {
      const label = "ch " + n
      const io_points = this.appendBlock(
        labels,
        boxes,
        label,
        spacing_h * total_length,
        spacing_v * (-active_channels / 2 + 0.5 + n),
        1
      )
      playbackchannels.push([io_points])
      const srclen = stages[stages.length - 1][n].length
      const src_p = stages[stages.length - 1][n][srclen - 1].output
      const dest_p = io_points.input
      this.appendLink(links, labels, src_p, dest_p)
    }
    stages.push(playbackchannels)
    return {labels, boxes, links, max_h, max_v}
  }

  createPipelinePlot() {
    let {labels, boxes, links, max_h, max_v} = this.makeShapes(this.props.config)
    if (max_h > 4 * max_v)
      max_v = max_h / 4
    else
      max_h = 4 * max_v

    const node = this.node
    const yScale = d3
      .scaleLinear()
      .domain([-max_v, max_v])
      .range([0, this.height])
    const xScale = d3
      .scaleLinear()
      .domain([-2, max_h])
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
    d3.select(node)
      .append("defs")
      .append("marker")
      .attr("id", "arrow")
      // @ts-ignore
      .attr("viewBox", [0, 0, markerBoxWidth, markerBoxHeight])
      .attr("refX", refX)
      .attr("refY", refY)
      .attr("markerWidth", markerBoxWidth)
      .attr("markerHeight", markerBoxHeight)
      .attr("orient", "auto-start-reverse")
      .attr("fill", this.arrowColor!)
      .attr("stroke", this.arrowColor!)
      .append("path")
      // @ts-ignore
      .attr("d", d3.line()(arrowPoints))

    const rects = d3
        .select(node)
        .selectAll("rect")
        .data(boxes)
        .enter()
        .append("rect")

    rects
      .attr("x", d => xScale(d.x))
      .attr("y", d => yScale(d.y))
      .attr("rx", xScale(0.1) - xScale(0))
      .attr("ry", yScale(0.1) - yScale(0))
      .attr("width", d => xScale(d.width) - xScale(0))
      .attr("height", d => yScale(d.height) - yScale(0))
      .style("fill", d => d.fill)
      .style("stroke", d => d.stroke)
      .style("stroke-width", d => d["stroke-width"])

    const text = d3
        .select(node)
        .selectAll("text")
        .data(labels)
        .enter()
        .append("text")

    //Add SVG Text Element Attributes
    text
      .text(d => d.text)
      .attr("font-size", d => yScale(d.size) - yScale(0) + "px")
      .attr("fill", d => d.fill)
      .style("text-anchor", "middle")
      .attr("transform", d => (`translate(${xScale(d.x)},${yScale(d.y)}), rotate(${d.angle})`))
      .attr("font-family", "sans-serif")

    d3.select(node)
      .selectAll(null)
      .data(links)
      .join("path")
      // @ts-ignore
      .attr("d", linkGen)
      .attr("marker-end", "url(#arrow)")
      .attr("fill", "none")
      .attr("stroke", this.arrowColor!)
  }

  render() {
    return <svg
        ref={node => this.node = node}
        viewBox={`0 0 ${this.width} ${this.height}`}
        style={{width: '100%', height: 'auto'}}
    />
  }
}