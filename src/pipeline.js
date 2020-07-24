import React from 'react';
import './index.css';
import { ParameterInput, InputField } from './common.js';
import cloneDeep from 'lodash/cloneDeep';


export class NameSelect extends React.Component {
  constructor(props) {
    super(props);
    this.handleChange = this.handleChange.bind(this);
    this.state = {value: this.props.value};
  }

  handleChange(event) {
    this.setState({ value: event.target.value });
    this.props.onSelect(event.target.value);
  }

  deleteName() {
    this.props.onDelete(this.props.idx)
  }

  render() {
    var vals = this.props.allnames;
    if (!vals) {
      return "";
    }
    var fields = vals.map(
      (val) => {
        return (
          <option key={val} value={val}>{val}</option>
        )
      }
    )
    return (
      <tr className="formrow">
        <td>
        <select name={this.props.desc} id={this.props.desc} value={this.state.value} onChange={this.handleChange}>
          {fields}
        </select>
        </td>
        <td>
          <button onClick={this.deleteName}>✖</button>
        </td>
      </tr>
    );
  }
}

export class MixerStep extends React.Component {
  constructor(props) {
    super(props);
    this.handleChange = this.handleChange.bind(this);
    this.state = {name: this.props.name};
  }

  handleChange(event) {
    this.setState({ value: event.target.value });
    this.props.onSelect(event.target.value);
  }

  render() {
    return (
      <tr className="formrow">
        <td>name</td>
        <td>
        <NameSelect value={this.state.name} allnames={this.props.allnames} onChange={this.handleChange} />
        </td>
      </tr>
    );
  }
}


export class FilterStep extends React.Component {
  constructor(props) {
    super(props);
    this.handleChange = this.handleChange.bind(this);
    this.state = {name: this.props.name};
  }

  handleChange(event) {
    this.setState({ value: event.target.value });
    this.props.onSelect(event.target.value);
  }

  render() {
    return (
      <tr className="formrow">
        <td>name</td>
        <td>
        <NameSelect value={this.state.name} allnames={this.props.allnames} onChange={this.handleChange} />
        </td>
      </tr>
    );
  }
}


// ---------------  NameList ---------------------------------------------
class NameList extends React.Component {
  constructor(props) {
    super(props);
    //console.log(this.props)
    this.state = { config: this.props.config };
    this.handleChange = this.handleChange.bind(this);
  }

  addName() {}

  render() {
    var names = this.state.names.map(
      (name, idx) => {
        return (
          <div key={idx}>
            <NameSelect key={Math.random()} idx={idx} name={name} allnames={this.props.allnames} onChange={this.handleMappingChange} />
          </div>
        )
      }
    )
    return (
      <div className="namelist">
        <div>names</div>
        <div className="names">
          {names}
          <div><button onClick={this.addName}>+</button></div>
        </div>
      </div>
    );
  }
}

// ---------------  PipelineStep ---------------------------------------------
class PipelineStep extends React.Component {
  constructor(props) {
    super(props);
    //console.log(this.props)
    this.state = { config: this.props.config };
    this.handleChange = this.handleChange.bind(this);
  }

  templates = {
    "Mixer": {
      name: "",
    },
    "Filter": {
      type: "Filter",
      channel: 0,
      names: [],
    }
  }

  handleMixerChange() {}

  handleFilterChange() {}

  handleChange() {}

  render() {
    var fields;
    if (this.state.config.type === "Mixer") {
      fields = 
        <div className="pipelinestep">
          <MixerStep key={Math.random()} idx={this.props.idx} config={this.state.config} onChange={this.handleMixerChange} />
        </div>;
    }
    else {
      fields = 
        <div className="pipelinestep">
          <FilterStep key={Math.random()} idx={this.props.idx} config={this.state.config} onChange={this.handleFilterChange} />
        </div>;
    }
    return (
      <div>
      <table><tbody>
        <NameSelect desc="type" type="pipelineitem" value={this.state.parameters.type} onSelect={this.handleSelect} />
        </tbody></table>
      <div>
        {fields}
      </div>
      </div> 
    );
  }
}


// ---------------  Pipeline ---------------------------------------------
export class Pipeline extends React.Component {
  constructor(props) {
    super(props);
    //this.handleChange = this.handleChange.bind(this);
    this.state = [];
    //this.state = {filters: {}, nbr: 0};
  }

  template = {
    type: "Filter",
    channel: 0,
    names: [],
  }

  handleMixerUpdate = (mixValue) => {
    console.log("MixerList got:", mixValue)
    this.setState(prevState => {
      prevState.mixers[mixValue.name] = mixValue.value;
      return prevState;
    })
  }

  updateName = (event) => {
    console.log("new name:", event);
    this.setState(prevState => {
      var mixers = prevState.mixers;
      delete Object.assign(mixers, { [event.value]: mixers[event.id] })[event.id];
      //this.setState({value: value});
      return prevState;
    })
  }

  handleChange(params) {
    this.setState(prevState => {
      console.log("mixers got:", params)
      var state = Object.assign({}, prevState);
      state.config = params;
      console.log("mixers new:", state)
      this.props.onChange(state.config);
      return state;
    })
  }

  addStep = (event) => {
    //event.preventDefault();
    this.setState(state => {
      const nbr = state.nbr + 1;
      const newname = "new" + nbr.toString();
      const mixers = Object.assign({}, state.mixers, { [newname]: cloneDeep(this.template) });
      console.log(mixers);
      return {
        mixers,
        nbr,
      };
    });
  }

  removeStep = (event) => {
    var i = event.target.id;
    console.log("delete", i);
    this.setState(state => {
      const nbr = state.nbr;
      const mixers = Object.assign({}, state.mixers);
      delete mixers[i];
      console.log(mixers);
      return {
        mixers,
        nbr,
      };
    });
  };

  render() {
    console.log("render:", this.state);
    return (
      <div>
        <div className="desc">Pipeline</div>
        <div className="pipeline">
          {
            this.state.map(
              (step, i) => {
                return (
                  <div key={Math.random()} className="pipelinestep">
                    <div>
                      <PipelineStep config={step} idx={i} onChange={this.handleMixerUpdate} />
                    </div>
                    <div>
                      <button onClick={this.removeStep} id={i}>✖</button>
                    </div>
                  </div>
                )
              }
            )
          }
          <button onClick={this.addStep}>+</button>
        </div>
      </div>
    );
  }
}




// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
//serviceWorker.unregister();
