/* The CSS files have to be imported in exactly this order.
   Otherwise the custom react-tabs styles in index.css don't work */
import "react-tabs/style/react-tabs.css"
import "react-tooltip/dist/react-tooltip.css"
import "./index.css"

import * as React from "react"
import { mdiAlert, mdiArrowULeftTop, mdiArrowURightTop, mdiImageSizeSelectSmall } from "@mdi/js"
import { cloneDeep } from "lodash"
import isEqual from "lodash/isEqual"
import { createTheme } from "react-data-table-component"
import { createRoot } from "react-dom/client"
import { Tab, TabList, TabPanel, Tabs } from "react-tabs"
import { Tooltip } from "react-tooltip"
import { Config, defaultConfig, getCaptureDeviceChannelCount, Filter, defaultFilter, DefaultFilterParameters, Mixer, PipelineStep } from "./camilladsp/config"
import { CompactView, isCompactViewEnabled, setCompactViewEnabled } from "./compactview"
import { DevicesTab } from "./devicestab"
import { Files } from "./filestab"
import { FiltersTab } from "./filterstab"
import { defaultGuiConfig, GuiConfig } from "./guiconfig"
import { UndoRedo } from "./main/UndoRedo"
import { MixersTab } from "./mixerstab"
import { PipelineTab } from "./pipeline/pipelinetab"
import { ProcessorsTab } from "./processorstab"
import { Shortcuts } from "./shortcuts"
import { SidePanel } from "./sidepanel/sidepanel"
import { TitleTab } from "./titletab"
import { Update } from "./utilities/common"
import { Errors, NoErrors } from "./utilities/errors"
import { loadStartupConfig } from "./utilities/files"
import { delayedExecutor, MdiButton, MdiIcon } from "./utilities/ui-components"

// ===== Добавить в src/index.tsx (перед классом CamillaConfig) =====


// ===== Заменить в src/index.tsx (удалить старую, вставить эту) =====

const XOVER_MIXER_NAME = 'xover';

const getKeyFilterName = (channelIndex: number, type: 'hpf' | 'lpf' | 'gain' | 'delay'): string => {
    return `${XOVER_MIXER_NAME}_ch${channelIndex + 1}_${type}`;
};

/**
 * Принимает конфигурацию и возвращает НОВУЮ, "достроенную" конфигурацию со структурой xover.
 * Эта функция не изменяет оригинальный объект (является "чистой").
 * @param originalConfig - Исходная конфигурация.
 * @returns Новый объект конфигурации с гарантированно существующей структурой xover.
 */
// ===== Заменить в src/index.tsx (вся функция getEnsuredXoverConfig) =====
const isKeyFilter = (filterName: string): boolean => {
    return filterName.startsWith(`${XOVER_MIXER_NAME}_ch`);
};


function syncXoverStructure(originalConfig: Config): Config {
    const config = cloneDeep(originalConfig);

    // Гарантируем, что все ключевые секции являются массивами/объектами
    if (!config.mixers) config.mixers = {};
    if (!config.filters) config.filters = {};
    if (!config.pipeline) config.pipeline = [];

    // --- Шаг 1: Убедиться, что микшер xover существует в секции 'mixers' ---
    let xoverMixer = Object.entries(config.mixers).find(([name, _]) => name.toLowerCase() === XOVER_MIXER_NAME)?.[1];
    if (!xoverMixer) {
        const newMixer: Mixer = { description: "Системный микшер", channels: { in: 2, out: 2 }, mapping: [ { dest: 0, sources: [{ channel: 0, gain: 0, scale: 'dB', inverted: false, mute: false }], mute: false }, { dest: 1, sources: [{ channel: 1, gain: 0, scale: 'dB', inverted: false, mute: false }], mute: false } ], labels: ["", ""] };
        config.mixers[XOVER_MIXER_NAME] = newMixer;
        xoverMixer = newMixer;
    }
    const channelCount = xoverMixer.channels.out;

    // --- Шаг 2: НОВАЯ LОГИКА - Убедиться, что микшер xover есть в pipeline ---
    const isXoverInPipeline = config.pipeline.some(step => step.type === 'Mixer' && step.name.toLowerCase() === XOVER_MIXER_NAME);
    if (!isXoverInPipeline) {
        // Если его нет, добавляем его в начало. Это критически важно!
        config.pipeline.unshift({
            type: 'Mixer',
            name: XOVER_MIXER_NAME,
            bypassed: null,
            description: "Системный разделитель каналов"
        });
    }

    // --- Шаг 3: Синхронизация фильтров и их шагов в pipeline ---
    const newPipelineSteps: PipelineStep[] = [];
    // 2. ДОБАВЛЯЕМ недостающие фильтры и шаги в pipeline
    for (let i = 0; i < channelCount; i++) {
        const hpfName = getKeyFilterName(i, 'hpf');
        if (!config.filters[hpfName]) {
            const hpf: Filter = { type: "BiquadCombo", description: `Системный ФВЧ ${i + 1}`, parameters: { ...DefaultFilterParameters.BiquadCombo.LinkwitzRileyHighpass, freq: 330, order: 2 } };
            config.filters[hpfName] = hpf;
            newPipelineSteps.push({ type: 'Filter', names: [hpfName], channels: [i], bypassed: null, description: null });
        }

        const lpfName = getKeyFilterName(i, 'lpf');
        if (!config.filters[lpfName]) {
            const lpf: Filter = { type: "BiquadCombo", description: `Системный ФНЧ ${i + 1}`, parameters: { ...DefaultFilterParameters.BiquadCombo.LinkwitzRileyLowpass, freq: 3300, order: 2 } };
            config.filters[lpfName] = lpf;
            newPipelineSteps.push({ type: 'Filter', names: [lpfName], channels: [i], bypassed: null, description: null });
        }

        const delayName = getKeyFilterName(i, 'delay');
        if (!config.filters[delayName]) {
            const delay: Filter = { type: "Delay", description: `Системная задержка ${i + 1}`, parameters: { ...DefaultFilterParameters.Delay.Default } };
            config.filters[delayName] = delay;
            newPipelineSteps.push({ type: 'Filter', names: [delayName], channels: [i], bypassed: null, description: null });
        }

        const gainName = getKeyFilterName(i, 'gain');
        if (!config.filters[gainName]) {
            const gain: Filter = { type: "Gain", description: `Системное усиление ${i + 1}`, parameters: { ...DefaultFilterParameters.Gain.Default } };
            config.filters[gainName] = gain;
            newPipelineSteps.push({ type: 'Filter', names: [gainName], channels: [i], bypassed: null, description: null });
        }
    }

    // 3. Добавляем все новые шаги в конец существующего pipeline
    if (newPipelineSteps.length > 0) {
        config.pipeline.push(...newPipelineSteps);
    }

    const allFilterNames = Object.keys(config.filters);
    for (const filterName of allFilterNames) {
        if (isKeyFilter(filterName)) {
            const channelMatch = filterName.match(/_ch(\d+)_/);
            if (channelMatch) {
                const filterChannelIndex = parseInt(channelMatch[1], 10) - 1;
                if (filterChannelIndex >= channelCount) {
                    delete config.filters[filterName];
                    config.pipeline = config.pipeline.filter(step => !(step.type === 'Filter' && step.names.includes(filterName)));
                }
            }
        }
    }

    return config;
}

class CamillaConfig extends React.Component<
  unknown,
  {
    activetab: number
    currentConfigFile?: string
    guiConfig: GuiConfig
    undoRedo: UndoRedo<Config>
    errors: Errors
    compactView: boolean
    message: string
    unsavedChanges: boolean
    unappliedChanges: boolean
    activeChannelTab: number | 'common'
  }
> {
  constructor(props: unknown) {
    super(props)
    this.updateConfig = this.updateConfig.bind(this)
    this.applyConfig = this.applyConfig.bind(this)
    this.fetchConfig = this.fetchConfig.bind(this)
    this.saveConfig = this.saveConfig.bind(this)
    this.saveAndApplyConfig = this.saveAndApplyConfig.bind(this)
    this.setCurrentConfig = this.setCurrentConfig.bind(this)
    this.setCurrentConfigFileName = this.setCurrentConfigFileName.bind(this)
    this.setErrors = this.setErrors.bind(this)
    this.switchTab = this.switchTab.bind(this)
    this.setCompactViewEnabled = this.setCompactViewEnabled.bind(this)
    this.NormalContent = this.NormalContent.bind(this)
    this.saveNotify = this.saveNotify.bind(this)
    this.applyNotify = this.applyNotify.bind(this)
    this.state = {
      activetab: 3, // Или 3, если хотите, чтобы вкладка Фильтры открывалась по умолчанию
      activeChannelTab: 0,
      guiConfig: defaultGuiConfig(),
      undoRedo: new UndoRedo(defaultConfig()), // <-- Возвращаем пустой конфиг по умолчанию
      errors: NoErrors,
      compactView: isCompactViewEnabled(),
      message: "",
      unsavedChanges: false,
      unappliedChanges: true,
    };

    this.loadGuiConfig();
    this.loadConfigAtStart(); // Эта функция теперь будет работать для "боевого" режима
    createTheme(
      "camilla",
      {
        text: {
          primary: "var(--text-color)",
          secondary: "var(--text-color)",
        },
        background: {
          default: "var(--background-color)",
        },
        context: {
          background: "#cb4b16",
          text: "#FFFFFF",
        },
        divider: {
          default: "var(--box-border-color)",
        },
        highlightOnHover: {
          default: "var(--active-button-background-color)",
        },
        sortFocus: {
          default: "var(--success-text-color)",
        },
      },
      "dark",
    )
  }

  private async loadGuiConfig() {
    fetch("/api/guiconfig")
      .then(
        (data) => data.json(),
        (err) => {
          console.log("Failed to fetch guiconfig", err)
        },
      )
      .then(
        (json) => this.setState({ guiConfig: json }),
        (err) => {
          console.log("Failed to parse guiconfig as json", err)
        },
      )
  }

private async loadConfigAtStart() {
    try {
      // 1. Загружаем активный конфиг с бэкенда
      const json = await loadStartupConfig();

      // 2. "Достраиваем" его нашей функцией (это остается!)
      const ensuredConfig = syncXoverStructure(json.config);

      // 3. Устанавливаем как текущий
      this.setCurrentConfig(json.configFileName ? json.configFileName : undefined, ensuredConfig);
      let message = ""
      if (json.source === "dsp") {
        message = "Loaded from DSP"
      } else if (json.source === "active") {
        message = "Loaded active"
      } else if (json.source === "default") {
        message = "Loaded default"
      }

      this.setState({ message: message });
    } catch (err) {
      // Просто логируем ошибку, если бэкенд недоступен
      console.log("Failed to get active config from backend:", err);
    }
  }

  private async fetchConfig() {
    const conf_req = await fetch("/api/getconfig")
    if (!conf_req.ok) {
      const errorMessage = await conf_req.text()
      this.setState({ message: errorMessage })
      throw new Error(errorMessage)
    }
    const config = await conf_req.json()
    if (config)
      this.setState({
        unsavedChanges: false,
        unappliedChanges: false,
        message: "OK",
        undoRedo: new UndoRedo(config),
      })
    else this.setState({ message: "No config received" })
  }

  private setCompactViewEnabled(enabled: boolean) {
    setCompactViewEnabled(enabled)
    this.setState({ compactView: enabled })
  }

private setActiveChannelTab = (tabIndex: number | 'common') => {
    // Мы будем хранить только числовые индексы. 'common' сбросим на 0.
    const indexToStore = typeof tabIndex === 'number' ? tabIndex : 0;
    this.setState({ activeChannelTab: tabIndex });
  }

  private saveNotify() {
    this.setState({ unsavedChanges: false })
  }

  private applyNotify() {
    this.setState({ unappliedChanges: false })
  }

  private readonly saveTimer = delayedExecutor(100)

  private updateConfig(update: Update<Config>, saveAfterDelay: boolean = false) {
    this.setState(
      (prevState) => {
        const newConfig = cloneDeep(prevState.undoRedo.current())
        update(newConfig)
        let unsavedChanges = true
        let unappliedChanges = true
        if (isEqual(newConfig, prevState.undoRedo.current())) {
          unsavedChanges = prevState.unsavedChanges
          unappliedChanges = prevState.unappliedChanges
        }
        return {
          unsavedChanges: unsavedChanges,
          unappliedChanges: unappliedChanges,
          undoRedo: prevState.undoRedo.changeTo(newConfig),
        }
      },
      () => {
        if (saveAfterDelay) this.saveTimer(this.applyConfig)
      },
    )
  }

  private async applyConfig(): Promise<void> {
    this.applyConfigRequest(this.state.currentConfigFile, this.state.undoRedo.current())
  }

  private async applyConfigRequest(filename: string | undefined, config: Config): Promise<void> {
    const conf_req = await fetch("/api/setconfig", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: filename,
        config: config,
      }),
    })
    const message = await conf_req.text()
    this.setState({ message: message, unappliedChanges: false })
    if (!conf_req.ok) throw new Error(message)
  }

  private async saveConfig() {
    if (this.state.currentConfigFile) {
      const conf_req = await fetch("/api/saveconfigfile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: this.state.currentConfigFile,
          config: this.state.undoRedo.current(),
        }),
      })
      const message = await conf_req.text()
      this.setState({ message: message, unsavedChanges: false })
      if (!conf_req.ok) throw new Error(message)
    }
  }

  private async saveAndApplyConfig() {
    await this.applyConfig()
    await this.saveConfig()
  }

  private setCurrentConfig(filename: string | undefined, config: Config) {
    this.setState({
      unsavedChanges: false,
      unappliedChanges: true,
      currentConfigFile: filename,
      undoRedo: new UndoRedo(config),
    })
  }

  private setCurrentConfigFileName(filename: string | undefined) {
    this.setState({
      currentConfigFile: filename,
    })
  }

  private setErrors(errors: Errors) {
    this.setState({ errors: errors })
  }

  componentDidUpdate(prevProps: unknown, prevState: { undoRedo: UndoRedo<Config> }) {
    const prevConfig = prevState.undoRedo.current();
    const currentConfig = this.state.undoRedo.current();

    const prevXover = Object.entries(prevConfig.mixers || {}).find(([name, _]) => name.toLowerCase() === XOVER_MIXER_NAME)?.[1];
    const currentXover = Object.entries(currentConfig.mixers || {}).find(([name, _]) => name.toLowerCase() === XOVER_MIXER_NAME)?.[1];

    if (!currentXover) {
        return;
    }

    const prevChannels = prevXover ? prevXover.channels.out : -1;
    const currentChannels = currentXover.channels.out;

    if (prevChannels !== currentChannels) {
        console.log(`Количество каналов Xover изменилось с ${prevChannels} на ${currentChannels}. Запускаю синхронизацию...`);
        const syncedConfig = syncXoverStructure(currentConfig);
        this.setState(prevState => ({
            undoRedo: prevState.undoRedo.changeTo(syncedConfig)
        }));
    }

    document.title = this.state.guiConfig.page_title
  }

  componentDidMount() {
    document.title = this.state.guiConfig.page_title
  }

  private switchTab(index: number) {
    this.setState({ activetab: index })
  }

  render() {
    return (
      <div className="configapp">
        <Tooltip id="main-tooltip" className="tooltip" />
        {this.state.compactView ? (
          <CompactView
            currentConfigName={this.state.currentConfigFile}
            config={this.state.undoRedo.current()}
            setConfig={(filename, config) => {
              this.setCurrentConfig(filename, config)
              this.applyConfigRequest(filename, config)
            }}
            updateConfig={(update) => this.updateConfig(update, true)}
            disableCompactView={() => this.setCompactViewEnabled(false)}
            guiConfig={this.state.guiConfig}
          />
        ) : (
          <this.NormalContent />
        )}
      </div>
    )
  }

  private NormalContent() {
    const { errors, undoRedo, currentConfigFile } = this.state
    const config = undoRedo.current()
    return (
      <>
        <SidePanel
          currentConfigFile={currentConfigFile}
          config={config}
          guiConfig={this.state.guiConfig}
          applyConfig={this.applyConfig}
          fetchConfig={this.fetchConfig}
          saveConfig={this.saveConfig}
          saveAndApplyConfig={this.saveAndApplyConfig}
          setErrors={this.setErrors}
          message={this.state.message}
          unsavedChanges={this.state.unsavedChanges}
          unappliedChanges={this.state.unappliedChanges}
        />
        <Tabs className="configtabs" selectedIndex={this.state.activetab} onSelect={this.switchTab}>
          <TabList>
            <Tab disabled={true}>
              <MdiButton
                icon={mdiImageSizeSelectSmall}
                tooltip="Change to compact view"
                onClick={() => this.setCompactViewEnabled(true)}
                buttonSize="tiny"
              />
              <MdiButton
                icon={mdiArrowULeftTop}
                tooltip={"Undo last change<br>" + undoRedo.undoDiff()}
                buttonSize="tiny"
                style={{
                  marginLeft: "10px",
                  marginRight: "10px",
                }}
                onClick={() =>
                  this.setState((prevState) => ({
                    undoRedo: prevState.undoRedo.undo(),
                  }))
                }
                enabled={undoRedo.canUndo()}
              />
              <MdiButton
                icon={mdiArrowURightTop}
                tooltip={"Redo last change<br>" + undoRedo.redoDiff()}
                buttonSize="tiny"
                onClick={() =>
                  this.setState((prevState) => ({
                    undoRedo: prevState.undoRedo.redo(),
                  }))
                }
                enabled={undoRedo.canRedo()}
              />
            </Tab>
            <Tab>Title</Tab>
            <Tab>Devices {errors.hasErrorsFor("devices") && <ErrorIcon />}</Tab>
            <Tab>Filters {errors.hasErrorsFor("filters") && <ErrorIcon />}</Tab>
            <Tab>Mixers {errors.hasErrorsFor("mixers") && <ErrorIcon />}</Tab>
            <Tab>Processors {errors.hasErrorsFor("processors") && <ErrorIcon />}</Tab>
            <Tab>Pipeline {errors.hasErrorsFor("pipeline") && <ErrorIcon />}</Tab>
            <Tab>Files</Tab>
            <Tab>Shortcuts</Tab>
          </TabList>
          <TabPanel />
          <TabPanel>
            <TitleTab config={config} updateConfig={this.updateConfig} />
          </TabPanel>
          <TabPanel>
            <DevicesTab
              devices={config.devices}
              guiConfig={this.state.guiConfig}
              updateConfig={this.updateConfig}
              errors={errors.forSubpath("devices")}
            />
          </TabPanel>
          <TabPanel>
            <FiltersTab
              config={config}
              samplerate={config.devices.samplerate}
              channels={getCaptureDeviceChannelCount(config.devices.capture)}
              coeffDir={this.state.guiConfig.coeff_dir}
              updateConfig={this.updateConfig}
              errors={errors.forSubpath("filters")}
              activeChannelTab={this.state.activeChannelTab}
              onChannelTabChange={this.setActiveChannelTab}
            />
          </TabPanel>
          <TabPanel>
            <MixersTab config={config} updateConfig={this.updateConfig} errors={errors.forSubpath("mixers")}
              syncXover={(currentConfig) => {
                const syncedConfig = syncXoverStructure(currentConfig);
                this.setState(prevState => ({
                    undoRedo: prevState.undoRedo.changeTo(syncedConfig)
                }));
              }}
            />
          </TabPanel>
          <TabPanel>
            <ProcessorsTab config={config} updateConfig={this.updateConfig} errors={errors.forSubpath("processors")} />
          </TabPanel>
          <TabPanel>
            <PipelineTab config={config} updateConfig={this.updateConfig} errors={errors.forSubpath("pipeline")} />
          </TabPanel>
          <TabPanel>
            <Files
              currentConfigFile={currentConfigFile}
              config={config}
              setCurrentConfig={this.setCurrentConfig}
              setCurrentConfigFileName={this.setCurrentConfigFileName}
              updateConfig={this.updateConfig}
              saveNotify={this.saveNotify}
              guiConfig={this.state.guiConfig}
            />
          </TabPanel>
          <TabPanel>
            <Shortcuts
              currentConfigName={currentConfigFile}
              config={this.state.undoRedo.current()}
              setConfig={(filename, config) => {
                this.setCurrentConfig(filename, config)
                this.applyConfigRequest(filename, config)
              }}
              updateConfig={(update) => this.updateConfig(update, true)}
              shortcutSections={this.state.guiConfig.custom_shortcuts}
            />
          </TabPanel>
        </Tabs>
      </>
    )
  }
}

function ErrorIcon() {
  return <MdiIcon icon={mdiAlert} tooltip="There are errors on this tab" style={{ color: "var(--error-text-color)" }} />
}

const container = document.getElementById("root")
const root = createRoot(container!)
root.render(<CamillaConfig />)
