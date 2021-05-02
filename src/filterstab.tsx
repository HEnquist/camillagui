import React from "react";
import cloneDeep from "lodash/cloneDeep";
import "./index.css";
import {mdiAlertCircle, mdiChartBellCurveCumulative, mdiCheck, mdiFileSearch, mdiUpload} from '@mdi/js';
import {
  Config,
  defaultFilter,
  Filter,
  filterNamesOf,
  Filters,
  newFilterName,
  removeFilter,
  renameFilter
} from "./config";
import {
  AddButton,
  BoolOption,
  Box,
  ChartPopup,
  DeleteButton,
  doUpload,
  EnumOption,
  FloatListOption,
  FloatOption,
  IntOption,
  ListSelectPopup,
  MdiButton,
  modifiedCopyOf,
  ParsedInput,
  TextOption,
  Update,
  UploadButton
} from "./common-tsx";

export class FiltersTab extends React.Component<
    {
      filters: Filters
      samplerate: number
      coeffDir: string
      updateConfig: (update: Update<Config>) => void
      errors: any
    },
    {
      popupVisible: boolean
      data: { name: string }
      filterKeys: { [name: string]: number}
      availableCoeffFiles: string[]
    }
> {
  constructor(props: any) {
    super(props)
    this.filterNames = this.filterNames.bind(this)
    this.addFilter = this.addFilter.bind(this)
    this.removeFilter = this.removeFilter.bind(this)
    this.renameFilter = this.renameFilter.bind(this)
    this.isFreeFilterName = this.isFreeFilterName.bind(this)
    this.updateFilter = this.updateFilter.bind(this)
    this.plotFilter = this.plotFilter.bind(this)
    this.closePopup = this.closePopup.bind(this)
    this.updateAvailableCoeffFiles = this.updateAvailableCoeffFiles.bind(this)
    this.state = {
      popupVisible: false,
      data: {name: ""},
      filterKeys: {},
      availableCoeffFiles: []
    }
    this.filterNames().forEach((name, i) => this.state.filterKeys[name] = i)
    this.updateAvailableCoeffFiles()
  }

  private filterNames(): string[] {
    return filterNamesOf(this.props.filters)
  }

  private addFilter() {
    this.props.updateConfig(config => {
      const newFilter = newFilterName(config.filters)
      this.setState(oldState =>
          modifiedCopyOf(oldState, newState =>
              newState.filterKeys[newFilter] = 1 + Math.max(0, ...Object.values(oldState.filterKeys))
          )
      )
      config.filters[newFilter] = defaultFilter()
    })
  }

  private removeFilter(name: string) {
    this.props.updateConfig(config => {
      removeFilter(config, name)
      this.setState(oldState =>
          modifiedCopyOf(oldState, newState => delete newState.filterKeys[name]))
    })
  }

  private renameFilter(oldName: string, newName: string) {
    if (this.isFreeFilterName(newName))
      this.props.updateConfig(config => {
        this.setState(oldState =>
            modifiedCopyOf(oldState, newState => {
              newState.filterKeys[newName] = newState.filterKeys[oldName]
              delete newState.filterKeys[oldName]
            }))
        renameFilter(config, oldName, newName);
      })
  }

  private isFreeFilterName(name: string): boolean {
    return !this.filterNames().includes(name)
  }

  private updateFilter(name: string, update: Update<Filter>) {
    this.props.updateConfig(config => update(config.filters[name]))
  }

  private plotFilter(name: string) {
    fetch("/api/evalfilter", {
      method: "POST",
      headers: { "Content-Type": "application/json", },
      body: JSON.stringify({
        name: name,
        config: this.props.filters[name],
        samplerate: this.props.samplerate,
      }),
    }).then(
      result => result.json()
          .then(data => this.setState({popupVisible: true, data: data})),
      error => console.log("Failed", error)
    )
  }

  private closePopup() {
    this.setState({ popupVisible: false })
  }

  private updateAvailableCoeffFiles() {
    fetch("/api/storedcoeffs")
        .then(
            result => result.json()
                .then(coeffFiles => this.setState({availableCoeffFiles: coeffFiles})),
            error => console.log("Could not load stored coeffs", error)
        )
  }

  render() {
    let {filters, errors} = this.props
    return <div className="tabpanel">
      {this.filterNames()
          .map(name =>
              <FilterView
                  key={this.state.filterKeys[name]}
                  name={name}
                  filter={filters[name]}
                  errors={errors ? errors[name] : undefined}
                  availableCoeffFiles={this.state.availableCoeffFiles}
                  updateFilter={update => this.updateFilter(name, update)}
                  rename={newName => this.renameFilter(name, newName)}
                  isFreeFilterName={this.isFreeFilterName}
                  remove={() => this.removeFilter(name)}
                  plot={() => this.plotFilter(name)}
                  updateAvailableCoeffFiles={this.updateAvailableCoeffFiles}
                  coeffDir={this.props.coeffDir}
              />
          )}
      <AddButton tooltip="Add a new filter" onClick={this.addFilter}/>
      <ChartPopup
        key={'plot-filter-popup'}
        open={this.state.popupVisible}
        data={this.state.data}
        onClose={this.closePopup}
      />
    </div>;
  }
}

function isConvolutionFilter(filter: Filter): boolean {
  return filter.type === 'Conv' && (filter.parameters.type === 'Raw' || filter.parameters.type === 'Wav')
}

interface FilterDefaults {
  type?: string
  format?: string
  skip_bytes_lines?: number
  read_bytes_lines?: number
  errors?: string[]
}

class FilterView extends React.Component<{
  name: string
  filter: Filter
  errors: any
  availableCoeffFiles: string[]
  updateFilter: (update: Update<Filter>) => void
  rename: (newName: string) => void
  isFreeFilterName: (name: string) => boolean
  remove: () => void
  plot: () => void
  updateAvailableCoeffFiles: () => void
  coeffDir: string
}, {
  uploadState?: { success: true } | { success: false, message: string }
  popupOpen: boolean
  filterDefaults: FilterDefaults
  showDefaults: boolean
} > {

  constructor(props: any) {
    super(props)
    this.uploadCoeffs = this.uploadCoeffs.bind(this)
    this.pickFilterFile = this.pickFilterFile.bind(this)
    this.updateDefaults = this.updateDefaults.bind(this)
    this.updateFilterParamsWithDefaults = this.updateFilterParamsWithDefaults.bind(this)
    this.state = {popupOpen: false, showDefaults: false, filterDefaults: {}}
    if (isConvolutionFilter(this.props.filter))
      this.updateDefaults(this.props.filter.parameters.filename)
  }

  private uploadCoeffs(e: React.ChangeEvent<HTMLInputElement>) {
    doUpload('coeff', e,
        filesnames => {
          this.setState({uploadState: {success: true}})
          const {updateAvailableCoeffFiles} = this.props
          this.pickFilterFile(filesnames[0])
          updateAvailableCoeffFiles()
        },
        message => this.setState({uploadState: {success: false, message: message}})
    )
  }

  private pickFilterFile(selectedFilename: string) {
    const {coeffDir, updateFilter} = this.props
    updateFilter(coeffFileNameUpdate(coeffDir, selectedFilename))
    this.updateDefaults(coeffFilePath(coeffDir, selectedFilename), true)
  }

  private updateDefaults(filename: string, updateFilter: boolean = false) {
    const filter = this.props.filter
    if (isConvolutionFilter(filter)) {
      fetch(`/api/defaultsforcoeffs?file=${encodeURIComponent(filename)}`)
          .then(response =>
              response.json().then(json => {
                const defaults = json as FilterDefaults
                this.setState({filterDefaults: defaults, showDefaults: false})
                if (updateFilter)
                  this.updateFilterParamsWithDefaults(defaults)
              })
          )
    }
  }

  private updateFilterParamsWithDefaults(defaults: FilterDefaults) {
    this.props.updateFilter(filter => {
      const subtype = defaults.type ? defaults.type : filter.parameters.type;
      const guiDefaults = cloneDeep(defaultParameters[filter.type][subtype])
      const filename = filter.parameters.filename;
      filter.parameters = guiDefaults;
      filter.parameters.filename = filename;
      filter.parameters = {...filter.parameters, ...defaults};
    })
  }

  render() {
    const {name, filter} = this.props
    const uploadState = this.state.uploadState;
    const isValidFilterName = (newName: string) =>
        name === newName || (newName.trim().length > 0 && this.props.isFreeFilterName(newName));
    let uploadIcon: { icon: string, className?: string, errorMessage?: string } =
        {icon: mdiUpload}
    if (uploadState !== undefined)
      uploadIcon = uploadState.success ?
          {icon: mdiCheck, className: 'success-text'}
          : {icon: mdiAlertCircle, className: 'error-text', errorMessage: uploadState.message}
    return <Box title={
      <ParsedInput
          style={{width: '300px'}}
          value={name}
          asString={x => x}
          parseValue={newName => isValidFilterName(newName) ? newName : undefined}
          data-tip="Filter name, must be unique"
          onChange={newName => this.props.rename(newName)}
      />
    }>
      <div style={{display: 'flex', flexDirection: 'row'}}>
        <div
            className="vertically-spaced-content"
            style={{display: 'flex', flexDirection: 'column', justifyContent: 'space-between'}}>
          {['Biquad', 'BiquadCombo', 'Conv', 'DiffEq'].includes(filter.type) &&
          <MdiButton
              icon={mdiChartBellCurveCumulative}
              tooltip="Plot frequency response of this filter"
              onClick={this.props.plot}/>
          }
          {isConvolutionFilter(filter) &&
          <>
            <MdiButton
                icon={mdiFileSearch}
                tooltip="Pick filter file"
                onClick={() => this.setState({popupOpen: true})}/>
            <UploadButton
                icon={uploadIcon.icon}
                className={uploadIcon.className}
                tooltip={uploadIcon.errorMessage ? uploadIcon.errorMessage : "Upload filter files"}
                onChange={this.uploadCoeffs}
                multiple={true}/>
          </>
          }
          <DeleteButton tooltip={"Delete this filter"} onClick={this.props.remove}/>
        </div>
        <FilterParams
            filter={this.props.filter}
            errors={this.props.errors}
            updateFilter={this.props.updateFilter}
            availableCoeffFiles={this.props.availableCoeffFiles}
            coeffDir={this.props.coeffDir}
            filterDefaults={this.state.filterDefaults}
            showDefaults={this.state.showDefaults}
            setShowDefaults={() => this.setState({showDefaults: true})}/>
      </div>
      <ListSelectPopup
          key="filter select popup"
          open={this.state.popupOpen}
          header={<div style={{margin: '10px 0'}}>Only single channel filter files are supported.</div>}
          items={this.props.availableCoeffFiles}
          onClose={() => this.setState({popupOpen: false})}
          onSelect={this.pickFilterFile}
      />
    </Box>
  }
}

function coeffFileNameFromPath(coeffDir: string, absolutePath: string): string {
  return absolutePath.replace(coeffDir, '')
}

function coeffFilePath(coeffDir: string, filename: string) {
  return coeffDir + filename;
}

function coeffFileNameUpdate(coeffDir: string, filename: string): Update<Filter> {
  return filter => filter.parameters.filename = coeffFilePath(coeffDir, filename)
}

const defaultParameters: {
  [type: string]: {
    [subtype: string]: {
      [parameter: string]: string | number | number[] | boolean
    }
  }
} = {
  Biquad: {
    Lowpass: { type: "Lowpass", q: 0.5, freq: 1000 },
    Highpass: { type: "Highpass", q: 0.5, freq: 1000 },
    Lowshelf: { type: "Lowshelf", gain: 6, slope: 6, freq: 1000 },
    Highshelf: { type: "Highshelf", gain: 6, slope: 6, freq: 1000 },
    LowpassFO: { type: "LowpassFO", freq: 1000 },
    HighpassFO: { type: "HighpassFO", freq: 1000 },
    LowshelfFO: { type: "LowshelfFO", gain: 6, freq: 1000 },
    HighshelfFO: { type: "HighshelfFO", gain: 6, freq: 1000 },
    Peaking: { type: "Peaking", gain: 6, q: 1.5, freq: 1000 },
    Notch: { type: "Notch", q: 1.5, freq: 1000 },
    Allpass: { type: "Allpass", q: 0.5, freq: 1000 },
    AllpassFO: { type: "AllpassFO", freq: 1000 },
    LinkwitzTransform: { type: "LinkwitzTransform", q_act: 1.5, q_target: 0.5, freq_act: 50, freq_target: 25 },
    Free: { type: "Free", a1: 0.0, a2: 0.0, b0: -1.0, b1: 1.0, b2: 0.0 },
  },
  BiquadCombo: {
    ButterworthLowpass: { type: "ButterworthLowpass", order: 2, freq: 1000 },
    ButterworthHighpass: { type: "ButterworthHighpass", order: 2, freq: 1000 },
    LinkwitzRileyLowpass: { type: "LinkwitzRileyLowpass", order: 2, freq: 1000 },
    LinkwitzRileyHighpass: { type: "LinkwitzRileyHighpass", order: 2, freq: 1000 },
  },
  Conv: {
    Raw: { type: "Raw", filename: "", format: "TEXT", skip_bytes_lines: 0, read_bytes_lines: 0 },
    Wav: { type: "Wav", filename: "", channel: 0 },
    Values: { type: "Values", values: [1.0, 0.0, 0.0, 0.0], length: 0 },
  },
  Delay: {
    Default: { delay: 0.0, unit: "ms", subsample: false },
  },
  Gain: {
    Default: { gain: 0.0, inverted: false, mute: false },
  },
  Volume: {
    Default: { ramp_time: 200 },
  },
  Loudness: {
    Default: { reference_level: 0.0, high_boost: 5, low_boost: 5, ramp_time: 200 },
  },
  DiffEq: {
    Default: { a: [1.0, 0.0], b: [1.0, 0.0] },
  },
  Dither: {
    Simple: { type: "Simple", bits: 16 },
    Uniform: { type: "Uniform", bits: 16, amplitude: 1.0 },
    Lipshitz441: { type: "Lipshitz441", bits: 16 },
    Fweighted441: { type: "Fweighted441", bits: 16 },
    Shibata441: { type: "Shibata441", bits: 16 },
    Shibata48: { type: "Shibata48", bits: 16 },
    None: { type: "None", bits: 16 },
  },
}

class FilterParams extends React.Component<{
  filter: Filter
  errors: any
  updateFilter: (update: Update<Filter>) => void
  availableCoeffFiles: string[]
  coeffDir: string
  filterDefaults: FilterDefaults
  setShowDefaults: () => void
  showDefaults: boolean
}, unknown> {
  constructor(props: any) {
    super(props)
    this.onTypeChange = this.onTypeChange.bind(this)
    this.onSubtypeChange = this.onSubtypeChange.bind(this)
    this.renderFilterParams = this.renderFilterParams.bind(this)
    this.hasHiddenDefaultValue = this.hasHiddenDefaultValue.bind(this)
    this.isHiddenDefaultValue = this.isHiddenDefaultValue.bind(this)
    this.filenameField = this.filenameField.bind(this)
  }

  private onTypeChange(type: string) {
    this.props.updateFilter(filter => {
      filter.type = type;
      const subtypeDefaults = defaultParameters[type];
      const firstSubtypeOrDefault = Object.keys(subtypeDefaults)[0];
      filter.parameters = cloneDeep(subtypeDefaults[firstSubtypeOrDefault])
    });
  }

  private onSubtypeChange(subtype: string) {
    this.props.updateFilter(filter =>
        filter.parameters = cloneDeep(defaultParameters[filter.type][subtype])
    );
  }

  render() {
    const {filter, errors} = this.props
    const subtypeOptions = Object.keys(defaultParameters[filter.type])
    return <div style={{width: '100%', textAlign: 'right'}}>
      <EnumOption
          value={filter.type}
          error={errors?.type}
          options={Object.keys(defaultParameters)}
          desc="type"
          data-tip="Filter type"
          onChange={this.onTypeChange}/>
      {subtypeOptions[0] !== 'Default' &&
      <EnumOption
          value={filter.parameters.type}
          error={errors?.parameters?.type}
          options={subtypeOptions}
          desc="subtype"
          data-tip="Filter subtype"
          onChange={this.onSubtypeChange}/>
      }
      {this.renderFilterParams(filter.parameters, errors?.parameters)}
      {isConvolutionFilter(this.props.filter) && !this.props.showDefaults && (this.hasHiddenDefaultValue()) &&
      <div
          className="button button-with-text"
          onClick={() => this.props.setShowDefaults()}>
        ...
      </div>
      }
    </div>
  }

  private renderFilterParams(parameters: { [p: string]: any }, errors?: any) {
    return Object.keys(parameters).map(parameter => {
      if (parameter === 'type') // 'type' is already rendered by parent component
        return null
      const info = this.parameterInfos[parameter]
      if (info === undefined) {
        console.log(`Rendering for filter parameter '${parameter}' is not implemented`)
        return null
      }
      const commonProps = {
        key: parameter,
        value: parameters[parameter],
        error: errors ? errors[parameter] : undefined,
        desc: info.desc,
        'data-tip': info.tooltip,
        onChange: (value: any) => this.props.updateFilter(filter => filter.parameters[parameter] = value)
      }
      if (parameter === 'filename')
        return this.filenameField(parameters['filename'], commonProps)
      if (this.isHiddenDefaultValue(parameter))
        return null;
      if (info.type === 'text')
        return <TextOption {...commonProps}/>
      if (info.type === 'int')
        return <IntOption {...commonProps}/>
      if (info.type === 'float')
        return <FloatOption {...commonProps}/>
      if (info.type === "bool")
        return <BoolOption {...commonProps}/>
      if (info.type === 'floatlist')
        return <FloatListOption {...commonProps}/>
      if (info.type === 'enum')
        return <EnumOption {...commonProps} options={info.options}/>
      return null
    })
  }

  private filenameField(
      filename: string,
      props: { onChange: (value: any) => void; "data-tip": string; value: any; key: string; desc: string }
  ) {
    const coeffDir = this.props.coeffDir;
    const selectedFile = coeffFileNameFromPath(coeffDir, filename)
    return <TextOption
        {...props}
        value={selectedFile}
        onChange={value => this.props.updateFilter(coeffFileNameUpdate(coeffDir, value))}/>
  }

  private hasHiddenDefaultValue() {
    const filterDefaults = this.props.filterDefaults;
    return filterDefaults && Object.keys(filterDefaults).length > 0 &&
        (this.isHiddenDefaultValue('skip_bytes_lines') || this.isHiddenDefaultValue('read_bytes_lines'))
  }

  private isHiddenDefaultValue(parameter: string) {
    const filter = this.props.filter
    const filterDefaults = this.props.filterDefaults
    return !this.props.showDefaults && (
        (parameter === 'skip_bytes_lines' && filter.parameters.skip_bytes_lines === filterDefaults.skip_bytes_lines)
        || (parameter === 'read_bytes_lines' && filter.parameters.read_bytes_lines === filterDefaults.read_bytes_lines)
    )
  }

  parameterInfos: {
    [type: string]: {
      type: 'text' | 'int' | 'float' | 'floatlist' | 'bool'
      desc: string
      tooltip: string
    } | {
      type: 'enum'
      desc: string
      tooltip: string
      options: string[]
    }
  } = {
    a: {
      type: "floatlist",
      desc: "a",
      tooltip: "Comma-separated list of coefficients for a",
    },
    a1: {
      type: "float",
      desc: "a1",
      tooltip: "Value for Biquad a1 coefficient",
    },
    a2: {
      type: "float",
      desc: "a2",
      tooltip: "Value for Biquad a2 coefficient",
    },
    b0: {
      type: "float",
      desc: "b0",
      tooltip: "Value for Biquad b0 coefficient",
    },
    b1: {
      type: "float",
      desc: "b1",
      tooltip: "Value for Biquad b1 coefficient",
    },
    b2: {
      type: "float",
      desc: "b2",
      tooltip: "Value for Biquad b2 coefficient",
    },
    amplitude: {
      type: "float",
      desc: "amplitude",
      tooltip: "Dither amplitude relative to target LSB",
    },
    b: {
      type: "floatlist",
      desc: "b",
      tooltip: "Comma-separated list of coefficients for b",
    },
    bits: { type: "int", desc: "bits", tooltip: "Target bit depth for dither" },
    channel: {
      type: "int",
      desc: "channel",
      tooltip: "Index of channel to use, starting from 0",
    },
    delay: { type: "float", desc: "delay", tooltip: "Delay in ms or samples" },
    filename: {
      type: "text",
      desc: "filename",
      tooltip:
          `Filter file name
           <br/>$samplerate$ will be replaced with the current samplerate
           <br/>$channels$ will be replaced with the number of channels of the capture device
          `,
    },
    format: {
      type: "enum",
      desc: "format",
      options: ["S16LE", "S24LE", "S24LE3", "S32LE", "FLOAT32LE", "FLOAT64LE", "TEXT"],
      tooltip: "Sample format",
    },
    freq: { type: "float", desc: "freq", tooltip: "Frequency" },
    freq_act: {
      type: "float",
      desc: "freq_act",
      tooltip: "Frequency of actual system",
    },
    freq_target: {
      type: "float",
      desc: "freq_target",
      tooltip: "Target frequency",
    },
    gain: { type: "float", desc: "gain", tooltip: "Gain in dB" },
    high_boost: {
      type: "float",
      desc: "high_boost",
      tooltip: "Volume boost for high frequencies when volume is at reference_level - 20dB",
    },
    inverted: { type: "bool", desc: "inverted", tooltip: "Invert signal" },
    length: {
      type: "int",
      desc: "length",
      tooltip: "Number of coefficients to generate",
    },
    low_boost: {
      type: "float",
      desc: "low_boost",
      tooltip: "Volume boost for low frequencies when volume is at reference_level - 20dB",
    },
    mute: { type: "bool", desc: "mute", tooltip: "Mute" },
    order: { type: "int", desc: "order", tooltip: "Filter order" },
    q: { type: "float", desc: "Q", tooltip: "Q-value" },
    q_act: {
      type: "float",
      desc: "Q actual",
      tooltip: "Q-value of actual system",
    },
    q_target: { type: "float", desc: "Q target", tooltip: "Target Q-value" },
    ramp_time: {
      type: "float",
      desc: "ramp_time",
      tooltip: "Volume change ramp time in ms",
    },
    read_bytes_lines: {
      type: "int",
      desc: "read_bytes_lines",
      tooltip: "Read up to this number of bytes or lines",
    },
    reference_level: {
      type: "float",
      desc: "reference_level",
      tooltip: "Volume level at which low_boost/high_boost is starting to be applied.<br>" +
          "Boost is scaled up linearly to reach the full value at reference_level - 20dB.<br>" +
          "Above reference_level only gain is applied.",
    },
    skip_bytes_lines: {
      type: "int",
      desc: "skip_bytes_lines",
      tooltip: "Number of bytes or lines to skip at beginning of file",
    },
    slope: {
      type: "float",
      desc: "slope",
      tooltip: "Filter slope in dB per octave",
    },
    subsample: { 
      type: "bool", 
      desc: "subsample", 
      tooltip: "Use subsample precision for delays" 
    },
    unit: {
      type: "enum",
      desc: "unit",
      options: ["ms", "samples"],
      tooltip: "Unit for delay",
    },
    values: {
      type: "floatlist",
      desc: "values",
      tooltip: "Comma separated list of filter coefficients",
    },
  };
}