import React from 'react';
import cloneDeep from 'lodash/cloneDeep';
import './index.css';
import { ParameterInput, InputField, EnumSelect} from './common.js';


class FilterParams extends React.Component {
  constructor(props) {
    super(props);
    this.handleChange = this.handleChange.bind(this);
    this.state = {parameters: this.props.parameters};
    console.log(this.state);
  }

  handleChange(parameters) {    
    this.setState(prevState => {
      const state = Object.assign({}, prevState);
      state.parameters = parameters;
      this.props.onChange(state)
      return state;
    })
  }

  templates = {
    Biquad: {
      Lowpass: {type: "Lowpass", q: 0.5, freq: 1000},
      Highpass: {type: "Highpass", q: 0.5, freq: 1000},
      Lowshelf: {type: "Lowshelf", gain: 6, slope: 6, freq: 1000},
      Highshelf: {type: "Highshelf", gain: 6, slope: 6, freq: 1000},
      LowpassFO: {type: "LowpassFO", freq: 1000},
      HighpassFO: {type: "HighpassFO", freq: 1000},
      LowshelfFO: {type: "LowshelfFO", gain: 6, freq: 1000},
      HighshelfFO: {type: "HighshelfFO", gain: 6, freq: 1000},
    },
    BiquadGroup: {
      ButterworthLowpass: {type: "ButterworthLowpass", order: 2, freq: 1000},
      ButterworthHighpass: {type: "ButterworthHighpass", order: 2, freq: 1000},
      LinkwitzRileyLowpass: {type: "LinkwitzRileyLowpass", order: 2, freq: 1000},
      LinkwitzRileyHighpass: {type: "LinkwitzRileyHighpass", order: 2, freq: 1000},
    },
    Conv: {
      File: {type: "File", filename: "", format: "TEXT", skip_bytes_lines: 0, read_bytes_lines: 0},
      Values: {type: "Values", values: "[1.0, 0.0, 0.0, 0.0]"},
    },
    Delay: {
      Default: { delay: 0.0,  unit: "ms"},
    },
    Gain: {
      Default: { gain: 0.0,  inverted: false },
    },
    DiffEq: {
      Default: { a: "[1.0]", b: "[1.0]"}
    },
    Dither: {
      Simple: {bits: 16},
      Uniform: {bits: 16, amplitude: 1.0},
      Lipshitz441: {bits: 16},
      Fweighted441: {bits: 16},
      Shibata441: {bits: 16},
      Shibata48: {bits: 16},
      None: {bits: 16},
    }
  }

  handleSelect = (selectValue) => {
    this.setState(prevState => {
      const template = cloneDeep(this.templates[this.props.type][selectValue]);
      const state = {parameters: template};
      this.props.onChange(state);
      return state;
    })
  }

  render() {
    console.log("--FilterParams, type:", this.props.type)
    var filterselect;
      filterselect = <ParameterInput  parameters={this.state.parameters} onChange={this.handleChange}/>;
    return (
      <div>
      <table><tbody>
        <EnumSelect desc="type" type={this.props.type} value={this.state.parameters.type} onSelect={this.handleSelect} />
        </tbody></table>
      <div>
        {filterselect}
      </div>
      </div> 
    );
  }
}





class Filter extends React.Component {
  constructor(props) {
    super(props);
    this.handleChange = this.handleChange.bind(this);
    this.state = {type: this.props.type, parameters: this.props.parameters};
    //this.state = {value: "biquad"};
  }

  templates = {
    "Biquad": {type: "Lowpass", q: 0.5, freq: 1000},
    "BiquadGroup": {type: "ButterworthHighpass", order: 2, freq: 1000},
    "Conv": {type: "File", filename: "", format: "TEXT", read_bytes_lines: 0, skip_bytes_lines:0},
    "Delay": { delay: 0.0,  unit: "ms"},
    "Gain": { gain: 0.0,  inverted: false },
    "DiffEq": { a: "[1.0, 0.0]", b: "[1.0, 0.0]"},
    "Dither": { type: "Simple", bits: 16 },
  }
  handleChange(event) {    
    this.setState({value: event.target.value}); 
  }

  handleFilterSelect = (filtValue) => {
    this.setState(prevState => {
      const state = Object.assign({}, prevState);
      state.parameters = cloneDeep(this.templates[filtValue]);
      state.type=filtValue;
      this.props.onFilter({name: this.props.name, type: state.type, parameters: state.parameters})
      console.log("--==Filter", state)
      return state;
    })
  }

  handleModifyFilter = (filtParams) => {
    this.setState(prevState => {
      const state = Object.assign({}, prevState);
      state.parameters = filtParams;
      this.props.onFilter({name: this.props.name, type: state.type, parameters: filtParams.parameters})
      console.log("--==--Filter", state)
      return state;
    })
  }

  render() {
    console.log("--Filter, state:", this.state)
    return (
      <div>
        <table><tbody>
          <EnumSelect desc="type" type="filter" value={this.state.type} onSelect={this.handleFilterSelect} />
        </tbody></table>
        <div>
          <FilterParams key={this.state.type} type={this.state.type} parameters={this.state.parameters} onChange={this.handleModifyFilter}/>
        </div>
      </div> 
    );
  }
}



export class FilterList extends React.Component {
  constructor(props) {
    super(props);
    //this.handleChange = this.handleChange.bind(this);
    this.state = {filters: {test1: {"type": "Biquad", "parameters": {"type": "Lowpass", "q": 0.7, "freq": 500}}, test2: {"type": "Biquad", "parameters": {"type": "Highpass", "q": 0.5, "freq": 1500}}}, nbr: 3};
    //this.state = {filters: {}, nbr: 0};
  }

  handleFilterUpdate = (filtValue) => {
    console.log("FilterList got:", filtValue)
    this.setState(prevState => {
      prevState.filters[filtValue.name] = {type: filtValue.type, parameters: filtValue.parameters};
      return prevState;
    })
  }

  updateName = (event) => {
    console.log("new name:", event);
    this.setState(prevState => {
      var filters = prevState.filters;
      delete Object.assign(filters, {[event.value]: filters[event.id] })[event.id];
      //this.setState({value: value});
      return prevState;
    })
  }

  handleChange(params) {
    this.setState(prevState => {
      console.log("filters got:", params)
      var state = Object.assign({}, prevState);
      state.config = params;
      console.log("filters new:", state)
      this.props.onChange(state.config);
      return state;
    })
  }

  addFilter = (event) => {
    //event.preventDefault();
    this.setState(state => {
      const nbr = state.nbr + 1;
      const newname = "new"+nbr.toString();
      const filters = Object.assign({}, state.filters, {[newname]: {"type": "Biquad", "parameters": {"type": "Lowpass", "q": 0.5, "freq": 1000}}});
      console.log(filters);
      return {
        filters,
        nbr,
      };
    });
  }

  removeFilter = (event) => {
    var i = event.target.id;
    console.log("delete", i);
    this.setState(state => {
      const nbr = state.nbr;
      const filters = Object.assign({}, state.filters);
      delete filters[i];
      console.log(filters);
      return {
        filters,
        nbr,
      };
    });
  };

  render() {
    console.log("render:", this.state);
    return (
      <div>
        <div className="desc">Filters</div>
        <div className="filters">
        {
          Object.keys(this.state.filters).map(
            (filt, i) => {   
              return (
                <div key={filt} className="filter">
                  <table><tbody><InputField key={filt} id={filt} desc="Name" type="text" value={filt} onChange={this.updateName}/></tbody></table>
                  <div className="filterparams">
                    <Filter type={this.state.filters[filt].type} parameters={this.state.filters[filt].parameters} name={filt} onFilter={this.handleFilterUpdate} />
                  </div>
                  <div>
                    <button onClick={this.removeFilter} id={filt}>✖</button>
                  </div>
                </div>
              )
            }
          )
        }
        <button onClick={this.addFilter}>+</button>
        </div>
      </div> 
    );
  }
}




// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
//serviceWorker.unregister();
