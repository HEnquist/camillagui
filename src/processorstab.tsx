import React from "react";
import "./index.css";
import {
  AddButton,
  BoolOption,
  Box,
  Button,
  DeleteButton,
  EnumInput,
  EnumOption,
  ErrorMessage,
  FloatInput,
  FloatListOption,
  FloatOption,
  IntOption,
  MdiButton,
  modifiedCopyOf,
  ParsedInput,
  TextOption,
  Update,
} from "./utilities/common-tsx";
import {
  Config,
  defaultProcessor,
  Processor,
  processorNamesOf,
  Processors,
  newProcessorName,
  removeProcessor,
  renameProcessor,
} from "./config";
import { mdiPlusMinusVariant, mdiVolumeOff } from "@mdi/js";
import { ErrorsForPath, errorsForSubpath } from "./utilities/errors";

export class ProcessorsTab extends React.Component<
  {
    processors: Processors;
    errors: ErrorsForPath;
    updateConfig: (update: Update<Config>) => void;
  },
  {
    processorKeys: { [name: string]: number };
  }
> {
  constructor(props: any) {
    super(props);
    this.processorNames = this.processorNames.bind(this);
    this.addProcessor = this.addProcessor.bind(this);
    this.renameProcessor = this.renameProcessor.bind(this);
    this.removeProcessor = this.removeProcessor.bind(this);
    this.isFreeProcessorName = this.isFreeProcessorName.bind(this);
    this.state = {
      processorKeys: {},
    };
    this.processorNames().forEach(
      (name, i) => (this.state.processorKeys[name] = i)
    );
  }

  private processorNames(): string[] {
    return processorNamesOf(this.props.processors);
  }

  private addProcessor() {
    this.props.updateConfig((config) => {
      const newProcessor = newProcessorName(config.processors);
      this.setState((oldState) =>
        modifiedCopyOf(
          oldState,
          (newState) =>
            (newState.processorKeys[newProcessor] =
              1 + Math.max(0, ...Object.values(oldState.processorKeys)))
        )
      );
      config.processors[newProcessor] = defaultProcessor();
    });
  }

  private removeProcessor(name: string) {
    this.props.updateConfig((config) => {
      removeProcessor(config, name);
      this.setState((oldState) =>
        modifiedCopyOf(
          oldState,
          (newState) => delete newState.processorKeys[name]
        )
      );
    });
  }

  private renameProcessor(oldName: string, newName: string) {
    if (this.isFreeProcessorName(newName))
      this.props.updateConfig((config) => {
        this.setState((oldState) =>
          modifiedCopyOf(oldState, (newState) => {
            newState.processorKeys[newName] = newState.processorKeys[oldName];
            delete newState.processorKeys[oldName];
          })
        );
        renameProcessor(config, oldName, newName);
      });
  }

  private isFreeProcessorName(name: string) {
    return !this.processorNames().includes(name);
  }

  render() {
    const { processors, errors, updateConfig } = this.props;
    return (
      <div className="tabpanel">
        <ErrorMessage message={errors({ path: [] })} />
        {this.processorNames().map((name) => (
          <ProcessorView
            key={this.state.processorKeys[name]}
            name={name}
            processor={processors[name]}
            errors={errorsForSubpath(errors, name)}
            update={(updateProcessor) =>
              updateConfig((config) => updateProcessor(config.processors[name]))
            }
            isFreeProcessorName={this.isFreeProcessorName}
            rename={(newName) => this.renameProcessor(name, newName)}
            remove={() => this.removeProcessor(name)}
          />
        ))}
        <div>
          <AddButton
            tooltip="Add a new processor"
            onClick={this.addProcessor}
          />
        </div>
      </div>
    );
  }
}

class ProcessorView extends React.Component<
  {
    name: string;
    processor: Processor;
    errors: ErrorsForPath;
    isFreeProcessorName: (name: string) => boolean;
    rename: (newName: string) => void;
    remove: () => void;
    update: (update: Update<Processor>) => void;
  },
  {
    showDefaults: boolean;
    processorDefaults: ProcessorDefaults;
  }
> {
  constructor(props: any) {
    super(props);
    this.state = { showDefaults: false, processorDefaults: defaultProcessor() };
  }

  render() {
    const { name, processor, errors, rename, remove, update } = this.props;
    const isValidProcessorName = (newName: string) =>
      name === newName ||
      (newName.trim().length > 0 && this.props.isFreeProcessorName(newName));
    return (
      <Box
        title={
          <>
            <ParsedInput
              value={name}
              style={{ width: "300px" }}
              data-tip="Processor name, must be unique"
              onChange={rename}
              asString={(name) => name}
              parseValue={(name) =>
                isValidProcessorName(name) ? name : undefined
              }
            />
            <DeleteButton
              tooltip="Delete this processor"
              smallButton={true}
              onClick={remove}
            />
          </>
        }
      >
        <ErrorMessage message={errors({ path: [] })} />
        <div style={{ display: "flex", justifyContent: "space-evenly" }}>
          <ProcessorParams
            processor={this.props.processor}
            errors={this.props.errors}
            updateProcessor={this.props.update}
            processorDefaults={this.state.processorDefaults}
            showDefaults={this.state.showDefaults}
            setShowDefaults={() => this.setState({ showDefaults: true })}
          />
        </div>
        <ErrorMessage message={errors({ path: ["channels"] })} />
      </Box>
    );
  }
}

interface ProcessorDefaults {
  type?: string;
  parameters: any;
}

class ProcessorParams extends React.Component<
  {
    processor: Processor;
    errors: ErrorsForPath;
    updateProcessor: (update: Update<Processor>) => void;
    processorDefaults: ProcessorDefaults;
    setShowDefaults: () => void;
    showDefaults: boolean;
  },
  unknown
> {
  constructor(props: any) {
    super(props);
    this.onTypeChange = this.onTypeChange.bind(this);
    this.renderProcessorParams = this.renderProcessorParams.bind(this);
  }

  private onTypeChange(type: string) {
    this.props.updateProcessor((processor) => {
      processor.type = type;
      //const firstSubtypeOrDefault = Object.keys(subtypeDefaults)[0];
      //processor.parameters = cloneDeep(subtypeDefaults[firstSubtypeOrDefault]);
    });
  }

  render() {
    const { processor, errors } = this.props;
    const defaults = defaultParameters
    const subtypeOptions = defaults ? Object.keys(defaults) : [];
    return (
      <div style={{ width: "100%", textAlign: "right" }}>
        <ErrorMessage message={errors({ path: [] })} />
        <EnumOption
          value={processor.type}
          error={errors({ path: ["type"] })}
          options={Object.keys(defaults)}
          desc="type"
          data-tip="Processor type"
          onChange={this.onTypeChange}
        />
        <ErrorMessage message={errors({ path: ["parameters"] })} />
        {this.renderProcessorParams(
          processor.parameters,
          errorsForSubpath(errors, "parameters")
        )}
      </div>
    );
  }

  private renderProcessorParams(
    parameters: { [p: string]: any },
    errors: ErrorsForPath
  ) {
    return Object.keys(parameters).map((parameter) => {
      if (parameter === "type")
        // 'type' is already rendered by parent component
        return null;
      const info = this.parameterInfos[parameter];
      if (info === undefined) {
        console.log(
          `Rendering for processor parameter '${parameter}' is not implemented`
        );
        return null;
      }
      const commonProps = {
        key: parameter,
        value: parameters[parameter],
        error: errors({ path: [parameter] }),
        desc: info.desc,
        "data-tip": info.tooltip,
        onChange: (value: any) =>
          this.props.updateProcessor(
            (processor) => (processor.parameters[parameter] = value)
          ),
      };
      if (info.type === "text") return <TextOption {...commonProps} />;
      if (info.type === "int") return <IntOption {...commonProps} />;
      if (info.type === "float") return <FloatOption {...commonProps} />;
      if (info.type === "bool") return <BoolOption {...commonProps} />;
      if (info.type === "floatlist")
        return <FloatListOption {...commonProps} />;
      if (info.type === "enum")
        return <EnumOption {...commonProps} options={info.options} />;
      return null;
    });
  }

  parameterInfos: {
    [type: string]:
      | {
          type: "text" | "int" | "float" | "floatlist" | "bool";
          desc: string;
          tooltip: string;
        }
      | {
          type: "enum";
          desc: string;
          tooltip: string;
          options: string[];
        };
  } = {
    channels: {
      type: "int",
      desc: "channels",
      tooltip: "Number of channel",
    },
    attack: {
      type: "float",
      desc: "attack",
      tooltip: "Attack time constant in seconds",
    },
    release: {
      type: "float",
      desc: "release",
      tooltip: "Release time constant in seconds",
    },
    threshold: {
      type: "float",
      desc: "compression threshold",
      tooltip: "Loudness in dB where compression sets in",
    },
    soft_clip: {
      type: "bool",
      desc: "soft clipping",
      tooltip: "Enable soft clipping",
    },
    clip_limit: {
      type: "float",
      desc: "clip limit",
      tooltip: "Level for soft clipping",
    },
    length: {
      type: "int",
      desc: "length",
      tooltip: "Number of coefficients to generate",
    },
    makeup_gain: {
      type: "float",
      desc: "makeup gain",
      tooltip: "Fixed makeup gain in dB.",
    },
    factor: {
      type: "float",
      desc: "factor",
      tooltip: "Compression factor",
    },
    monitor_channels: {
      type: "floatlist",
      desc: "monitor_channels",
      tooltip: "Comma separated list of channels to monitor",
    },
    process_channels: {
      type: "floatlist",
      desc: "process_channels",
      tooltip: "Comma separated list of channels to process",
    },
  };
}

const defaultParameters: {
  [type: string]: {
    [parameter: string]: string | number | number[] | boolean
  }
} = {
  Compressor: {
    channels: 2,
    attack: 0.025,
    release: 1.0,
    threshold: -25,
    factor: 5.0,
    makeup_gain: 15,
    soft_clip: true,
    clip_limit: -2,
    monitor_channels: [0, 1],
    process_channels: [0, 1],
  },
}