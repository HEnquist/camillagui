import React, {Component} from "react"
import {Set} from "immutable"
import {Box, Button, CheckBox, MdiButton, UploadButton} from "./utilities/ui-components"
import {GuiConfig} from "./guiconfig"
import {
  mdiAlertCircle,
  mdiCheck,
  mdiContentSave,
  mdiDelete,
  mdiDownload,
  mdiRefresh,
  mdiStar,
  mdiStarOutline,
  mdiUpload
} from '@mdi/js'
import {Config, defaultConfig} from "./camilladsp/config"
import ReactTooltip from "react-tooltip"
import {
  CFile,
  doUpload, download,
  fileNamesOf,
  loadActiveConfig,
  loadConfigJson,
  loadDefaultConfigJson,
  loadFiles
} from "./utilities/files"
import {ImportPopup, ImportPopupProps} from "./import/importpopup"
import {Update} from "./utilities/common"

export function Files(props: {
  guiConfig: GuiConfig
  currentConfigFile?: string
  config: Config
  setCurrentConfig: (filename: string | undefined, config: Config) => void
  setCurrentConfigFileName: (filename: string | undefined) => void
  updateConfig: (update: Update<Config>) => void
  saveNotify: () => void
}) {
  return <div className="wide-tabpanel">
    <NewConfig currentConfig={props.config}
               setCurrentConfig={props.setCurrentConfig}
               updateConfig={props.updateConfig}/>
    <FileTable title='Configs'
               type="config"
               currentConfigFile={props.currentConfigFile}
               config={props.config}
               setCurrentConfig={props.setCurrentConfig}
               setCurrentConfigFileName={props.setCurrentConfigFileName}
               saveNotify={props.saveNotify}
               canUpdateActiveConfig={props.guiConfig.can_update_active_config}/>
    <FileTable title='Filters' type="coeff"/>
  </div>
}

interface FileTableProps {
  title: string
  type: "config" | "coeff"
  currentConfigFile?: string
  config?: Config
  canUpdateActiveConfig?: boolean
  setCurrentConfig?: (filename: string, config: Config) => void
  setCurrentConfigFileName?: (filename: string | undefined) => void
  saveNotify?: () => void
}

type FileAction = 'load' | 'save' | 'upload'
const EMPTY_FILENAME = '' // used only for FileAction 'upload'
type FileStatus =
    {
      filename: string,
      action: FileAction
      success: true
    } |
    {
      filename: string
      action: FileAction
      success: false
      statusText: string
    }

class FileTable extends Component<
    FileTableProps,
    {
      files: CFile[]
      selectedFiles: Set<string>
      activeConfigFileName: string
      newFileName: string
      fileStatus: FileStatus | null
      stopTimer: () => void
    }> {

  private readonly type: "config" | "coeff" = this.props.type
  private readonly canLoadAndSave: boolean = this.type === "config"

  constructor(props: FileTableProps) {
    super(props)
    this.update = this.update.bind(this)
    this.loadActiveConfigName = this.loadActiveConfigName.bind(this)
    this.setActiveConfig = this.setActiveConfig.bind(this)
    this.toggleAllFileSelection = this.toggleAllFileSelection.bind(this)
    this.toggleFileSelection = this.toggleFileSelection.bind(this)
    this.areAllFilesSelected = this.areAllFilesSelected.bind(this)
    this.upload = this.upload.bind(this)
    this.delete = this.delete.bind(this)
    this.downloadAsZip = this.downloadAsZip.bind(this)
    this.overwriteConfig = this.overwriteConfig.bind(this)
    this.saveConfig = this.saveConfig.bind(this)
    this.loadConfig = this.loadConfig.bind(this)
    this.showErrorMessage = this.showErrorMessage.bind(this)
    this.state = {
      files: [],
      selectedFiles: Set(),
      activeConfigFileName: '',
      newFileName: 'New config.yml',
      fileStatus: null,
      stopTimer: () => {}
    }
  }

  componentDidUpdate() {
    ReactTooltip.rebuild()
  }

  componentDidMount() {
    this.update()
    const timerId = setInterval(this.update, 1000)
    this.setState({stopTimer: () => clearInterval(timerId)})
    this.loadActiveConfigName()
  }

  componentWillUnmount() {
    this.state.stopTimer()
  }

  private update() {
    loadFiles(this.type)
        .then(files => {
          return this.setState(prevState => ({
            files: files,
            selectedFiles: prevState.selectedFiles.intersect(fileNamesOf(files))
          }));
        })
  }

  private async delete() {
    const del = window.confirm("Delete?\n" + this.state.selectedFiles.join('\n'))
    if (!del)
      return
    await fetch(`/api/delete${this.type}s`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(this.state.selectedFiles),
    })
    this.setState({fileStatus: null})
    this.update()
  }

  private async downloadAsZip() {
    const response = await fetch(`/api/download${this.type}szip`, {
      method: "POST",
      headers: { "Content-Type": "application/json", },
      body: JSON.stringify(this.state.selectedFiles),
    })
    const zipFile = await response.blob()
    download(this.type + 's.zip', zipFile)
  }

  private upload(files: FileList) {
    doUpload(
        this.type,
        files,
        () => {
          this.setState({
            fileStatus: {filename: EMPTY_FILENAME, action: 'upload', success: true}
          })
          this.update()
        },
        message => this.setState({
          fileStatus: {filename: EMPTY_FILENAME, action: 'upload', success: false, statusText: message}
        })
    )
  }

  private async loadConfig(name: string) {
    try {
      const jsonConfig = await loadConfigJson(name, reason => this.showErrorMessage(name, 'load', reason))
      this.props.setCurrentConfig!(name, jsonConfig as Config)
      this.setState({fileStatus: {filename: name, action: 'load', success: true}})
    } catch(e) {
      this.showErrorMessage(name, 'load', e)
    }
  }

  private showErrorMessage(filename: string, action: FileAction, errorMessage: string) {
    this.setState({
      fileStatus: {filename: filename, action: action, success: false, statusText: errorMessage}
    })
  }

  private async loadActiveConfigName() {
    try {
      const json = await loadActiveConfig()
      this.setState({activeConfigFileName: json.configFileName})
    }
    catch (err) {
      console.log("Failed to get active config", err)
    }
  }

  private setActiveConfig(name: string) {
    fetch("/api/setactiveconfigfile", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({name: name})
    }).then(() => this.loadConfig(name))
    this.setState({activeConfigFileName: name})
  }

  private overwriteConfig(name: string) {
    const del = window.confirm("Overwrite?\n" + name)
    if (!del)
      return
    this.saveConfig(name)
  }

  private async saveConfig(name: string) {
    const { config, setCurrentConfig } = this.props
    try {
      const response = await fetch(`/api/saveconfigfile`, {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({filename: name, config: config}),
      })
      if (response.ok) {
        setCurrentConfig!(name, config!)
        this.setState({fileStatus: {filename: name, action: 'save', success: true}})
        if (this.props.saveNotify !== undefined)
          this.props.saveNotify()
        this.update()
      } else {
        const message = await response.text()
        this.showErrorMessage(name, 'save', message)
      }
    } catch (e) {
      this.showErrorMessage(name, 'save', e.message)
    }
  }

  private toggleAllFileSelection() {
    this.setState(prevState => {
      let files = fileNamesOf(prevState.files)
      const newSelection = this.areAllFilesSelected() ? Set<string>() : Set(files)
      return Object.assign({}, prevState, {selectedFiles: newSelection})
    })
  }

  private toggleFileSelection(filename: string) {
    this.setState(prevState => {
      const selection = prevState.selectedFiles
      const newSelection = selection.has(filename) ? selection.delete(filename) : selection.add(filename)
      return Object.assign({}, prevState, {selectedFiles: newSelection})
    })
  }

  private areAllFilesSelected(): boolean {
    const { files, selectedFiles } = this.state
    return files.length > 1 && selectedFiles.isSuperset(fileNamesOf(files))
  }

  render() {
    const {files, selectedFiles, fileStatus, newFileName, activeConfigFileName} = this.state
    return (
      <Box title={this.props.title}>
        <div style={{
          display: 'grid',
          alignItems: 'center',
          gridTemplateColumns: 'min-content min-content min-content min-content 100%',
          gap: '5px 5px'
        }}>

          {/* Header row */}
          <FileCheckBox
              filename={"all files"}
              checked={this.areAllFilesSelected()}
              onChange={this.toggleAllFileSelection}/>
          <DownloadFilesAsZipButton selectedFiles={selectedFiles} downloadAsZip={this.downloadAsZip}/>
          <DeleteFilesButton selectedFiles={selectedFiles} delete={this.delete}/>
          <UploadFilesButton fileStatus={fileStatus} upload={this.upload}/>
          <div>
            <FileStatusMessage filename={EMPTY_FILENAME} fileStatus={fileStatus}/>
          </div>

          { // File rows
            files.flatMap(({name, lastModified}) => [
                  <FileCheckBox
                      key={name+'(1)'}
                      filename={name}
                      checked={selectedFiles.has(name)}
                      onChange={() => this.toggleFileSelection(name)}/>,
                  !this.canLoadAndSave ? null : <SetActiveButton
                      key={name+'(2)'}
                      active={name === activeConfigFileName}
                      onClick={() => this.setActiveConfig(name)}
                      enabled={this.props.canUpdateActiveConfig}/>,
                  !this.canLoadAndSave ? null : <SaveButton
                      key={name+'(3)'}
                      filename={name}
                      fileStatus={fileStatus}
                      saveConfig={this.overwriteConfig}/>,
                  !this.canLoadAndSave ? null : <LoadButton
                      key={name+'(4)'}
                      filename={name}
                      fileStatus={fileStatus}
                      loadConfig={this.loadConfig}/>,
                  <div key={name+'(5)'} style={this.canLoadAndSave ? {} : {gridColumn: '2 / span 4'}}>
                    <FileDownloadButton type={this.type}
                                        filename={name}
                                        isCurrentConfig={this.props.currentConfigFile === name}/>
                    <FileStatusMessage filename={name} fileStatus={fileStatus}/>
                    {' - ' + lastModified}
                  </div>
                ]
            )
          }

          { // "Save to new config" row
            this.canLoadAndSave && <>
            <div/>
            <div/>
            <SaveButton
                disableReason={reasonToDisableSaveNewFileButton(newFileName, files)}
                filename={newFileName}
                fileStatus={fileStatus}
                saveConfig={this.saveConfig}/>
            <div/>
            <div>
              <input type='text'
                     value={newFileName}
                     data-tip="Enter a name for the new config file"
                     onChange={(e) => this.setState({newFileName: e.target.value})}/>
              <FileStatusMessage filename={newFileName} fileStatus={fileStatus}/>
            </div>
          </>
          }
        </div>
      </Box>
    )
  }
}

function FileCheckBox(props: {checked: boolean, filename: string, onChange: (checked: boolean) => void}) {
  const {checked, filename, onChange} = props
  let tooltip = (checked ? "Unselect " : "Select ") + filename
  return <CheckBox tooltip={tooltip} checked={checked} onChange={onChange}/>
}

function DownloadFilesAsZipButton(props: { selectedFiles: Set<string>, downloadAsZip: () => {} }) {
  const {selectedFiles, downloadAsZip} = props
  const fileOrFiles = selectedFiles.size > 1 ? 'files' : 'file'
  return <MdiButton
      icon={mdiDownload}
      tooltip={selectedFiles.isEmpty()
          ? 'Download selected files<br>Select at least one file first!'
          : `Download ${selectedFiles.size} ${fileOrFiles} as zip file`}
      enabled={!selectedFiles.isEmpty()}
      onClick={downloadAsZip}/>
}

function DeleteFilesButton(props: { selectedFiles: Set<string>, delete: () => {} }) {
  const selectedFiles = props.selectedFiles
  const fileOrFiles = selectedFiles.size > 1 ? 'files' : 'file'
  return <MdiButton
      icon={mdiDelete}
      tooltip={selectedFiles.isEmpty()
          ? 'Delete selected files<br>Select at least one file first!'
          : `Delete ${selectedFiles.size} ${fileOrFiles}`}
      enabled={!selectedFiles.isEmpty()}
      onClick={props.delete}/>
}

function UploadFilesButton(props: {
  fileStatus: FileStatus | null,
  upload: (files: FileList) => void
}) {
  const fileStatus = props.fileStatus
  let uploadIcon: { icon: string, className?: string } =
      {icon: mdiUpload}
  if (fileStatus !== null
      && fileStatus.action === 'upload'
      && fileStatus.filename === EMPTY_FILENAME
      && !fileStatus.success)
    uploadIcon = {icon: mdiAlertCircle, className: 'error-text'}
  return <UploadButton
      icon={uploadIcon.icon}
      tooltip={'Upload files'}
      upload={props.upload}
      className={uploadIcon.className}
      multiple={true}/>
}

function SetActiveButton(props: {active: boolean, onClick: () => void, enabled?: boolean}) {
  const {active, onClick, enabled} = props
  let tooltip
  if (enabled === false) {
    tooltip = "Mark this config file as active.<br>Disabled since the backend is not able to store the active config file.<br>Check the backend configuration."
  }
  else {
    if (active) {
      tooltip = "This config file is marked as active."
    }
    else {
      tooltip = "Mark this config file as active, and load it into the GUI."
    }
  }

  return <MdiButton
      enabled={enabled}
      icon={active ? mdiStar : mdiStarOutline}
      tooltip={tooltip}
      highlighted={active}
      onClick={onClick}/>
}

function SaveButton(
    props: {
      filename: string,
      disableReason?: string,
      fileStatus: FileStatus | null,
      saveConfig: (filename: string) => void
    }
) {
  const { disableReason, filename, fileStatus, saveConfig } = props
  let saveIcon: { icon: string, className?: string } =
      {icon: mdiContentSave}
  if (!disableReason && fileStatus !== null && fileStatus.action === 'save' && fileStatus.filename === filename) {
    saveIcon = fileStatus.success ?
        {icon: mdiCheck, className: 'success-text'}
        : {icon: mdiAlertCircle, className: 'error-text'}
  }
  return <MdiButton
      icon={saveIcon.icon}
      className={saveIcon.className}
      enabled={!disableReason}
      tooltip={disableReason ? disableReason : `Save from GUI to ${filename}`}
      onClick={() => saveConfig(filename)}/>
}

function LoadButton(
    props: {
      filename: string,
      fileStatus: FileStatus | null,
      loadConfig: (filename: string) => void
    }
) {
  const { filename, fileStatus, loadConfig } = props
  let loadIcon: { icon: string, className?: string } =
      {icon: mdiRefresh}
  if (fileStatus !== null && fileStatus.action === 'load' && fileStatus.filename === filename) {
    loadIcon = fileStatus.success ?
        {icon: mdiCheck, className: 'success-text'}
        : {icon: mdiAlertCircle, className: 'error-text'}
  }
  return <MdiButton
      icon={loadIcon.icon}
      className={loadIcon.className}
      tooltip={`Load into GUI from ${filename}`}
      onClick={() => loadConfig(filename)}/>
}

function FileDownloadButton(props: { type: string, filename: string, isCurrentConfig: boolean }) {
  const { type, filename, isCurrentConfig } = props
  const classNames = 'file-link'
  return <a className={classNames}
            style={{width: 'max-content'}}
            data-tip={'Download '+filename + (isCurrentConfig ? '<br>This is the config file currently loaded in this Editor' : '')}
            download={filename}
            target="_blank"
            rel="noopener noreferrer"
            href={`/${type}/${filename}`}>
    {filename}
  </a>
}

function FileStatusMessage(props: { filename: string, fileStatus: FileStatus | null }) {
  const {fileStatus, filename} = props
  if (fileStatus && !fileStatus.success && fileStatus.filename === filename)
    return <div className={fileStatus.success ? 'success-text' : 'error-text'}>
      Could not {fileStatus.action} config:<br/>
      {fileStatus.statusText}
    </div>
  else
    return null
}

function reasonToDisableSaveNewFileButton(newFileName: string, files: CFile[]): string | undefined {
  if (!isValidFilename(newFileName))
    return 'Please enter a valid file name.'
  else if (fileNamesOf(files).includes(newFileName))
    return `File "${newFileName}" already exists`
  return undefined
}

function isValidFilename(newFileName: string) {
  return newFileName.trim().length > 0
}

class NewConfig extends Component<
    {
      currentConfig: Config
      setCurrentConfig?: (filename: string | undefined, config: Config) => void
      updateConfig: (update: Update<Config>) => void
    },
    { importPopupProps: ImportPopupProps }
> {

  constructor(props: any) {
    super(props)
    this.loadDefaultConfig = this.loadDefaultConfig.bind(this)
    this.state = {importPopupProps: {}}
  }

  componentDidUpdate() {
    ReactTooltip.rebuild()
  }

  private async loadDefaultConfig() {
    try {
      const response = await loadDefaultConfigJson()
      if (!response.ok) {
        console.log(await response.text())
        return
      }
      const jsonConfig = await response.json()
      this.props.setCurrentConfig!(undefined, jsonConfig as Config)
    } catch(e) {
      console.log(e)
    }
  }

  private loadBlankConfig() {
    let config = defaultConfig()
    this.props.setCurrentConfig!(undefined, config as Config)
  }

  private openImportConfigPopup() {
    this.setState({
      importPopupProps: {
        currentConfig: this.props.currentConfig,
        updateConfig: this.props.updateConfig,
        close: () => this.setState({importPopupProps: {}})
      }
    })
  }

  render() {
    return (
      <Box title='Create or import config'>
        <div style={{
          marginTop: '10px',
          display: 'grid',
          alignItems: 'center',
          gridTemplateColumns: '40% 28% 28%',
          columnGap: '2%'
        }}>
          <Button
            text="New config from default"
            onClick={() => this.loadDefaultConfig()}
            enabled={true}
            data-tip="Create and load a new config using the default config as a template.<br>Any unsaved changes will be lost."
          />
          <Button
            text="New blank config"
            onClick={() => this.loadBlankConfig()}
            enabled={true}
            data-tip="Create and load a new blank config.<br>Any unsaved changes will be lost."
          />
          <Button
            text="Import config"
            onClick={() => this.openImportConfigPopup()}
            enabled={true}
            data-tip="Import items from another config into this one."
          />
        </div>
        <ImportPopup {...this.state.importPopupProps}/>
      </Box>
    )
  }
}