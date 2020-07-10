import React from 'react';
import './index.css';
import { ParameterInput, InputField, FormatSelect } from './common.js';



class BackendSelect extends React.Component {
  constructor(props) {
    super(props);
    this.handleChange = this.handleChange.bind(this);
    this.state = {value: this.props.value};
  }

  handleChange(event) {    
    this.setState({value: event.target.value});
    this.props.onSelect(event.target.value);  
  }

  render() {
    return (
      <div>
        <select name="capture" id="capture" onChange={this.handleChange} value={this.state.value}>
          <option value="alsa">Alsa</option>
          <option value="pulseaudio">PulseAudio</option>
          <option value="coreaudio">CoreAudio</option>
          <option value="wasapi">Wasapi</option>
          <option value="file">File</option>
        </select>
      </div> 
    );
  }
}

class ResamplerSelect extends React.Component {
  constructor(props) {
    super(props);
    this.handleChange = this.handleChange.bind(this);
  }

  handleChange(event) {    
    this.setState({value: event.target.value});
    this.props.onSelect(event.target.value);  
  }

  render() {
    return (
      <div>
        <select name="resampler" id="resampler" onChange={this.handleChange}>
          <option value="fastasync">FastAsync</option>
          <option value="balancedasync">BalancedAsync</option>
          <option value="accurateasync">AccurateAsync</option>
          <option value="synchronous">Synchronous</option>
        </select>
      </div> 
    );
  }
}



export class Capture extends React.Component {
  constructor(props) {
    super(props);
    this.handleChange = this.handleChange.bind(this);
    this.state = {params: {type: "alsa", ...this.getCaptureTemplate("alsa")}};
    console.log(this.state);
  }

  handleChange(parameters) {    
    this.setState(prevState => {
      const state = Object.assign({}, prevState);
      state.params.parameters = parameters;
      return state;
    })
  }

  getCaptureTemplate(type) {
    if (type === "alsa") {
      return {channels: 2, format: "S32LE", device: "hw:0"};
    }
    else if (type === "file") {
        return {channels: 2, format: "S32LE", file: "hw:0"};
    }
    else if (type === "pulseaudio") {
        return {channels: 2, format: "S32LE", device: "something.monitor"};
    }
    else if (type === "wasapi") {
        return {channels: 2, format: "FLOAT32LE", device: "blablawin"};
    }
    else if (type === "coreaudio") {
        return {channels: 2, format: "FLOAT32LE", device: "blablamac"};
    }
  }

  handleSelect = (selectValue) => {
    this.setState(prevState => {
        const type = selectValue;
        const params = this.getCaptureTemplate(type);
        console.log("capture", params);
        return {params};
      })
  }

  handleFormat = (selectValue) => {
    this.setState(prevState => {
        const format = selectValue;
        const state = Object.assign({}, prevState);
        //console.log("capture", state);
        state.format = format;
        return state;
      })
  }

  render() {
    var backendparams = <ParameterInput  parameters={this.state.params} onChange={this.handleChange}/>;
    return (
      <div>
      <div>
        <BackendSelect value={this.state.params.type} onSelect={this.handleSelect}/>
      </div>
      <div>
        <FormatSelect value={this.state.params.format} onSelect={this.handleFormat}/>
      </div>
      <div>
        {backendparams}
      </div>
      </div> 
    );
  }
}






// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
//serviceWorker.unregister();
