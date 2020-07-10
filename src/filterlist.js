import React from 'react';
import './index.css';
import { ParameterInput, InputField } from './common.js';



class BiquadSelect extends React.Component {
  constructor(props) {
    super(props);
    this.handleChange = this.handleChange.bind(this);
    this.state = {value: this.props.value};
  }

  handleChange(event) {    
    this.setState({value: event.target.value});
    this.props.onSelectFilter(event.target.value);  
  }

  render() {
    return (
      <div>
        <select name="biquad" id="biquad" onChange={this.handleChange} value={this.state.value}>
          <option value="lowpass">Lowpass</option>
          <option value="highpass">Highpass</option>
          <option value="highshelf">Higlshelf</option>
          <option value="lowshelf">Lowshelf</option>
        </select>
      </div> 
    );
  }
}

class ConvSelect extends React.Component {
  constructor(props) {
    super(props);
    this.handleChange = this.handleChange.bind(this);
  }

  handleChange(event) {    
    this.setState({value: event.target.value});
    this.props.onSelectFilter(event.target.value);  
  }

  render() {
    return (
      <div>
        <select name="conv" id="conv" onChange={this.handleChange}>
          <option value="file">File</option>
          <option value="values">Values</option>
        </select>
      </div> 
    );
  }
}

class FilterSelect extends React.Component {
  constructor(props) {
    super(props);
    this.handleChange = this.handleChange.bind(this);
    this.state = {value: this.props.value};
  }

  handleChange(event) {    
    this.setState({value: event.target.value});  
    this.props.onSelectFilter(event.target.value);  
  }

  render() {
    return (
      <div>
        <select name="filter" id="filter" onChange={this.handleChange} value={this.state.value}>
          <option value="biquad">Biquad</option>
          <option value="conv">Conv</option>
        </select>
      </div> 
    );
  }
}

class Biquad extends React.Component {
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
      return state;
    })
    this.getState((curState) => { this.props.onChange(curState) });
  }

  getBiquadTemplate(type) {
    if (type === "lowpass") {
      return {"type": "lowpass", "q": 0.5, "freq": 1000};
    }
    else if (type === "highpass") {
      return {"type": "highpass", "q": 0.5, "freq": 1000};
    }
    else if (type === "lowshelf") {
      return {"type": "lowshelf", "slope": 6, "freq": 1000};
    }
    else if (type === "highshelf") {
      return {"type": "highshelf", "slope": 6, "freq": 1000};
    }
  }

  handleSelect = (selectValue) => {
    this.setState(prevState => {
      const template = this.getBiquadTemplate(selectValue);
      const state = {parameters: template};
      this.props.onModifyFilter(state);
      return state;
    })
  }

  render() {
    var filterselect;
      filterselect = <ParameterInput  parameters={this.state.parameters} onChange={this.handleChange}/>;
    return (
      <div>
      <div>
        <BiquadSelect value={this.state.parameters.type} onSelectFilter={this.handleSelect}/>
      </div>
      <div>
        {filterselect}
      </div>
      </div> 
    );
  }
}

class Conv extends React.Component {
  constructor(props) {
    super(props);
    this.handleChange = this.handleChange.bind(this);
    this.state = {value: "file"};
  }

  handleChange(event) {    
    this.setState({value: event.target.value}); 
  }

  handleFilter = (value) => {
    this.setState({value: value});
}

  render() {
    var filterselect;
    if (this.state.value==="file") {
      const vals = {'Path': 'text'};
      filterselect = <ParameterInput  values={vals} />;    
    }
    else if (this.state.value==="values") {
      const vals = {'Values': 'text'};
      filterselect = <ParameterInput  values={vals} />;    
    }
    return (
      <div>
      <div>
        <ConvSelect onSelectFilter={this.handleFilter}/>
      </div>
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

  handleChange(event) {    
    this.setState({value: event.target.value}); 
  }


  getFilterTemplate(type) {
    if (type === "biquad") {
      return {type: "biquad", parameters: {"type": "lowpass", "q": 0.5, "freq": 1000}};
    }
    else if (type === "conv") {
      return {type: "conv", parameters: {"type": "file", "path": ""}};
    }
  }

  handleFilterSelect = (filtValue) => {
    this.setState(prevState => {
      const state = this.getFilterTemplate(filtValue);
      this.props.onFilter(state);
      return state;
    })
  }

  handleModifyFilter = (filtParams) => {
    this.setState(prevState => {
      const state = Object.assign({}, prevState);
      state.parameters = filtParams;
      this.props.onFilter(state)
      return state;
    })
  }

  render() {
    var filterselect;
    if (this.props.type==="biquad") {
      filterselect = <Biquad type={this.state.type} parameters={this.state.parameters} onModifyFilter={this.handleModifyFilter}/>;    
    }
    else {
      filterselect = <Conv params={this.state.parameters}/>;  
    };
    return (
      <div className="filter">
        <div>
          <FilterSelect onSelectFilter={this.handleFilterSelect}/>
        </div>
        <div>
          {filterselect}
        </div>
      </div> 
    );
  }
}

export class FilterList extends React.Component {
  constructor(props) {
    super(props);
    //this.handleChange = this.handleChange.bind(this);
    this.state = {filters: {test1: {"type": "biquad", "parameters": {"type": "lowpass", "q": 0.7, "freq": 500}}, test2: {"type": "biquad", "parameters": {"type": "highpass", "q": 0.5, "freq": 1500}}}, nbr: 3};
    //this.state = {filters: {}, nbr: 0};
  }

  handleFilterUpdate = (filtValue) => {
    this.setState({value: filtValue});
  }

  addFilter = (event) => {
    //event.preventDefault();
    this.setState(state => {
      const nbr = state.nbr + 1;
      const newname = "new"+nbr.toString();
      const filters = Object.assign({}, state.filters, {[newname]: {"type": "biquad", "parameters": {"type": "lowpass", "q": 0.5, "freq": 1000}}});
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
        {
          Object.keys(this.state.filters).map(
            (filt, i) => {   
              return (
                <div key={filt} className="listitem">
                  <div><InputField desc="Name" type="text" value={filt}/></div>
                  <div>
                    <Filter type={this.state.filters[filt].type} parameters={this.state.filters[filt].parameters} onFilter={this.handleFilterUpdate} />
                  </div>
                  <div>
                    <button onClick={this.removeFilter} id={filt}>del</button>
                  </div>
                </div>
              )
            }
          )
        }
        <button onClick={this.addFilter}>+</button>
      </div> 
    );
  }
}




// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
//serviceWorker.unregister();
