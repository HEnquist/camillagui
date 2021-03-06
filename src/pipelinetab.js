import React from "react";
import "./index.css";
import {PipelinePopup} from './pipelineplotter.js';
import {EnumSelect, ParameterInput} from "./common.js";
import cloneDeep from "lodash/cloneDeep";
import isEqual from "lodash/isEqual";
import {FLASKURL} from "./index.tsx";
import {AddButton, ChartPopup, DeleteButton, PlotButton} from "./common-tsx";

export class NameSelect extends React.Component {
  constructor(props) {
    super(props);
    this.handleChange = this.handleChange.bind(this);
    this.state = { value: this.props.value };
  }

  componentDidUpdate(prevProps) {
    if (!isEqual(this.props.value, prevProps.value)) {
      this.setState({ value: this.props.value });
    }
  }

  handleChange(event) {
    this.setState({ value: event.target.value });
    this.props.onChange({ idx: this.props.idx, value: event.target.value });
  }

  deleteName = () => {
    this.props.onDelete(this.props.idx);
  };

  render() {
    var vals = this.props.allnames;
    if (!vals) {
      return "";
    }
    var options = vals.map((val) => {
      return (
        <option key={val} value={val}>
          {val}
        </option>
      );
    });
    var button;
    if (this.props.show_button) {
      button = (
        <div className="column right">
          <DeleteButton tooltip="Remove this item from the list" onClick={this.deleteName}/>
        </div>
      );
    }
    return (
      <div className="row">
        <select
          className="column left"
          name={this.props.desc}
          id={this.props.desc}
          value={this.state.value}
          data-tip="Name of the item"
          onChange={this.handleChange}
        >
          {options}
        </select>
        {button}
      </div>
    );
  }
}

export class MixerStep extends React.Component {
  constructor(props) {
    super(props);
    this.handleChange = this.handleChange.bind(this);
    this.state = { name: this.props.name };
  }

  componentDidUpdate(prevProps) {
    if (!isEqual(this.props.config, prevProps.config)) {
      this.setState({ config: this.props.config });
    }
  }

  handleChange(event) {
    console.log("MixerStep change name", event.value);
    this.setState((prevState) => {
      prevState.value = event.value;
      this.props.onChange(prevState.value);
      return prevState;
    });
  }

  render() {
    return (
      <NameSelect
        value={this.state.name}
        allnames={this.props.allnames}
        onChange={this.handleChange}
      />
    );
  }
}

export class FilterStep extends React.Component {
  constructor(props) {
    super(props);
    //this.handleChange = this.handleChange.bind(this);
    this.state = { config: cloneDeep(this.props.config), popup: false, data: {} };
  }

  plotFilterStep = (event) => {
    //var i = event.target.id;
    const fullconf = this.props.getConfig();
    const plotconf = { index: this.props.idx, config: fullconf };
    fetch(FLASKURL + "/api/evalfilterstep", {
      method: "POST",
      headers: { "Content-Type": "application/json", },
      cache: "no-cache",
      body: JSON.stringify(plotconf),
    }).then(
      (result) => {
        result.json().then((data) => {
          this.setState({ popup: true, data: data });
        });
        console.log("OK", result);
      },
      (error) => {
        console.log("Failed", error);
      }
    );
  };

  componentDidUpdate() {
    if (!isEqual(this.props.config, this.state.config)) {
      this.setState({ config: cloneDeep(this.props.config) });
    }
  }

  handleClose = () => {
    this.setState((state) => {
      return { popup: false };
    });
  };

  handleChange = (event) => {
    console.log("new names", event);
    this.setState((state) => {
      state.config.names = event;
      this.props.onChange({ idx: this.props.idx, value: state.config });
      return state;
    });
  };

  handleParChange = (event) => {
    this.setState((state) => {
      state.config.channel = event.channel;
      this.props.onChange({ idx: this.props.idx, value: state.config });
      return state;
    });
  };

  render() {
    return (
      <div className="pipelinestep">
        <ParameterInput
          parameters={this.state.config}
          onChange={this.handleParChange}
        />
        <div>Names</div>
        <NameList
          names={this.state.config.names}
          allnames={this.props.allnames}
          onChange={this.handleChange}
        />
        <PlotButton tooltip="Plot response of this step" onClick={this.plotFilterStep}/>
        <ChartPopup
          key={this.state.popup}
          open={this.state.popup}
          data={this.state.data}
          onClose={this.handleClose}
        />
      </div>
    );
  }
}

// ---------------  NameList ---------------------------------------------
class NameList extends React.Component {
  constructor(props) {
    super(props);
    //console.log(this.props)
    this.state = { names: cloneDeep(this.props.names) };
    //this.handleChange = this.handleChange.bind(this);
  }

  componentDidUpdate() {
    if (!isEqual(this.props.names, this.state.names)) {
      this.setState({ names: cloneDeep(this.props.names) });
    }
  }

  addName = () => {
    //event.preventDefault();
    this.setState((state) => {
      state.names.push(cloneDeep(this.props.allnames[0]));
      this.props.onChange(state.names);
      return state;
    });
  };

  deleteName = (idx) => {
    console.log("Delete a name", idx);
    this.setState((prevState) => {
      prevState.names.splice(idx, 1);
      this.props.onChange(prevState.names);
      return prevState;
    });
  };

  handleChange = (event) => {
    console.log("change name", event);
    this.setState((prevState) => {
      prevState.names[event.idx] = event.value;
      this.props.onChange(prevState.names);
      return prevState;
    });
  };

  render() {
    var names = this.state.names.map((name, idx) => {
      return (
        <NameSelect
          key={name + "_" + idx.toString()}
          idx={idx}
          name={name}
          value={name}
          allnames={this.props.allnames}
          onChange={this.handleChange}
          onDelete={this.deleteName}
          show_button={true}
        />
      );
    });
    return (
      <div className="namelist">
        {names}
        <div>
          <AddButton tooltip="Add a filter to the list" onClick={this.addName}/>
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
    this.state = { config: cloneDeep(this.props.config) };
    this.handleSelect = this.handleSelect.bind(this);
  }

  templates = {
    Mixer: {
      type: "Mixer",
      name: "",
    },
    Filter: {
      type: "Filter",
      channel: 0,
      names: [],
    },
  };

  componentDidUpdate() {
    if (!isEqual(this.props.config, this.state.config)) {
      this.setState({ config: cloneDeep(this.props.config) });
    }
  }

  handleMixerChange = (mixer) => {
    console.log("handleMixerChange", mixer);
    this.setState((prevState) => {
      prevState.config.name = mixer;
      this.props.onChange({ idx: this.props.idx, value: prevState.config });
      return prevState;
    });
  };

  handleFilterChange = (filter) => {
    console.log("handleFilterChange", filter);
    this.setState((prevState) => {
      prevState.config = filter.value;
      //this.props.onChange(filter);
      this.props.onChange({ idx: this.props.idx, value: prevState.config });
      return prevState;
    });
  };

  handleSelect(event) {
    console.log("change step type", event);
    this.setState((prevState) => {
      var templ = cloneDeep(this.templates[event]);
      prevState.config = templ;
      if (event === "Mixer") {
        templ["name"] = this.props.mixers[0];
      }
      this.props.onChange({ idx: this.props.idx, value: prevState.config });
      return prevState;
    });
  }

  render() {
    var fields;
    if (this.state.config.type === "Mixer") {
      fields = (
        <div className="row">
          <MixerStep
            key={this.props.idx}
            idx={this.props.idx}
            name={this.state.config.name}
            allnames={this.props.mixers}
            onChange={this.handleMixerChange}
          />
        </div>
      );
    } else {
      fields = (
        <div className="row">
          <FilterStep
            key={this.props.idx}
            idx={this.props.idx}
            config={this.state.config}
            allnames={this.props.filters}
            onChange={this.handleFilterChange}
            getConfig={this.props.getConfig}
          />
        </div>
      );
    }
    return (
      <div>
        <div className="row">
          <EnumSelect
            desc="type"
            data-tip="Step type, Mixer or Filter"
            type="pipelineitem"
            value={this.state.config.type}
            onSelect={this.handleSelect}
          />
        </div>
        {fields}
      </div>
    );
  }
}

// ---------------  Pipeline ---------------------------------------------
export class PipelineTab extends React.Component {
  constructor(props) {
    super(props);
    //this.handleChange = this.handleChange.bind(this);
    this.state = { config: cloneDeep(props.config), popup: false, image: null };
    //this.state = {filters: {}, nbr: 0};
  }

  template = {
    type: "Filter",
    channel: 0,
    names: [],
  };

  componentDidUpdate() {
    if (!isEqual(this.props.config, this.state.config)) {
      this.setState({ config: cloneDeep(this.props.config) });
    }
  }

  handleStepUpdate = (mixValue) => {
    console.log("MixerList got:", mixValue);
    this.setState((prevState) => {
      prevState.config[mixValue.idx] = mixValue.value;
      this.props.onChange(prevState.config);
      return prevState;
    });
  };

  updateName = (event) => {
    console.log("new name:", event);
    this.setState((prevState) => {
      var mixers = prevState.mixers;
      delete Object.assign(mixers, { [event.value]: mixers[event.id] })[
        event.id
      ];
      this.props.onChange(prevState.config);
      return prevState;
    });
  };

  addStep = () => {
    //event.preventDefault();
    this.setState((state) => {
      state.config.push(cloneDeep(this.template));
      this.props.onChange(state.config);
      return state;
    });
  };

  removeStep = (event) => {
    var i = event.target.id;
    console.log("delete", i);
    this.setState((state) => {
      state.config.splice(i, 1);
      this.props.onChange(state.config);
      return state;
    });
  };

  plotPipeline = (event) => {
    var i = event.target.id;
    console.log("PLot!!!", i);
    fetch(FLASKURL + "/api/evalpipelinesvg", {
      method: "POST", // *GET, POST, PUT, DELETE, etc.
      //mode: "same-origin", // no-cors, *cors, same-origin
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
      body: JSON.stringify(this.props.getConfig()), // body data type must match "Content-Type" header
    }).then(
      (result) => {
        result.blob().then((data) => {
          this.setState((state) => {
            return { popup: true, image: data };
          });
        });
        console.log("OK", result);
      },
      (error) => {
        console.log("Failed", error);
      }
    );
  };

  handleClose = () => {
    this.setState((state) => {
      return { popup: false };
    });
  };

  render() {
    console.log("render:", this.state);
    return (
      <div>
        <div className="pipeline">
          {this.state.config.map((step, i) => {
            return (
              <div
                key={i}
                className="pipelinestep"
              >
                <div>
                  <PipelineStep
                    config={step}
                    idx={i}
                    mixers={this.props.mixers}
                    filters={this.props.filters}
                    onChange={this.handleStepUpdate}
                    getConfig={this.props.getConfig}
                  />
                </div>
                <div>
                  <DeleteButton tooltip="Delete this step" onClick={this.removeStep}/>
                </div>
              </div>
            );
          })}
          <div>
            <AddButton tooltip="Add a pipeline step" onClick={this.addStep}/>
            <PlotButton tooltip="Plot the pipeline" onClick={this.plotPipeline}/>
          </div>
          <PipelinePopup
            key={this.state.popup}
            open={this.state.popup}
            config={this.props.getConfig()}
            onClose={this.handleClose}
          />
        </div>
      </div>
    );
  }
}




