// ===== Файл: src/MultichannelFiltersView.tsx (ПОЛНАЯ ИСПРАВЛЕННАЯ ВЕРСИЯ) =====
// В самом верху файла MultichannelFiltersView.tsx
import { Chart } from './utilities/chart'; // Наш новый диспетчер
import { MultiChannelPlotData } from './utilities/MultiChannelChart'; // Наша новая структура данных
import React, { useState, useEffect, useMemo } from 'react'; // Добавляем useEffect и useMemo
import { Box, MdiButton, FloatOption, AddButton, EnumOption, IntOption  } from './utilities/ui-components';
import { Config, Filter, newFilterName, DefaultFilterParameters, defaultFilter, renameFilter, removeFilter, Mixer } from './camilladsp/config';
import { Errors } from './utilities/errors';
import { Update } from './utilities/common';
import { FiltersTabProps } from './filterstab';
import { ClassicFiltersView, FilterView } from './ClassicFiltersView'; // Переиспользуем!
import { mdiPlusMinusVariant, mdiVolumeOff, mdiToggleSwitch, mdiToggleSwitchOffOutline } from '@mdi/js';
import cloneDeep from 'lodash/cloneDeep';
// В начало файла MultichannelFiltersView.tsx
import { CHANNEL_COLORS } from './utilities/chart';

// --- Блок хелперов для управления конфигурацией ---

const XOVER_MIXER_NAME = 'xover';

/**
 * Генерирует стандартизированное имя для "ключевого" фильтра.
 */
const getKeyFilterName = (channelIndex: number, type: 'hpf' | 'lpf' | 'gain' | 'delay'): string => {
    return `${XOVER_MIXER_NAME}_ch${channelIndex + 1}_${type}`;
};

/**
 * Проверяет, является ли фильтр "ключевым" (системным) по его имени.
 */
const isKeyFilter = (filterName: string): boolean => {
    return filterName.startsWith(`${XOVER_MIXER_NAME}_ch`);
};

/**
 * Находит все дополнительные (не ключевые) фильтры, примененные к конкретному каналу в pipeline.
 */
const findAdditionalFiltersForChannel = (config: Config, channelIndex: number): string[] => {
    if (!config.pipeline) return [];
    const additionalFilters: Set<string> = new Set();
    for (const step of config.pipeline) {
        if (step.type === 'Filter' && step.channels?.includes(channelIndex)) {
            step.names.forEach(filterName => {
                if (!isKeyFilter(filterName)) {
                    additionalFilters.add(filterName);
                }
            });
        }
    }
    return Array.from(additionalFilters);
};

/**
 * Находит все "общие" фильтры (те, что не привязаны к каналам xover).
 */
const findCommonFilterNames = (config: Config): string[] => {
    if (!config.filters) return [];
    const allFilterNames = Object.keys(config.filters);
    // ИСПРАВЛЕНО: Используем Object.entries для поиска микшера по имени (ключу)
    const xoverMixerEntry = Object.entries(config.mixers || {}).find(([name, _]) => name.toLowerCase() === XOVER_MIXER_NAME);
    const channelCount = xoverMixerEntry ? xoverMixerEntry[1].channels.out : 0;
    
    const assignedFilterNames = new Set<string>();
    for (let i = 0; i < channelCount; i++) {
        ['hpf', 'lpf', 'gain', 'delay'].forEach(type => assignedFilterNames.add(getKeyFilterName(i, type as any)));
        findAdditionalFiltersForChannel(config, i).forEach(name => assignedFilterNames.add(name));
    }
    
    return allFilterNames.filter(name => !assignedFilterNames.has(name));
};

/**
 * Включает/выключает bypass для конкретного фильтра во всей цепочке pipeline.
 */
export const toggleFilterBypassInPipeline = (config: Config, filterName: string, bypassed: boolean) => {
    if (!config.pipeline) return;
    config.pipeline.forEach(step => {
        if (step.type === 'Filter' && step.names.includes(filterName)) {
            step.bypassed = bypassed ? true : null;
        }
    });
};

/**
 * Добавляет новый фильтр в pipeline для конкретного канала.
 */
export const addFilterToPipeline = (config: Config, filterName: string, channelIndex: number) => {
    if (!config.pipeline) config.pipeline = [];
    config.pipeline.push({
        type: 'Filter',
        names: [filterName],
        channels: [channelIndex],
        bypassed: false,
        description: `Доп. фильтр для канала ${channelIndex + 1}`
    });
};

/**
 * Удаляет фильтр из всех шагов pipeline. Если шаг остается пустым, удаляет и его.
 */
const removeFilterFromPipeline = (config: Config, filterName: string) => {
    if (!config.pipeline) return;
    config.pipeline = config.pipeline
        .map(step => {
            if (step.type === 'Filter' && step.names.includes(filterName)) {
                step.names = step.names.filter(name => name !== filterName);
            }
            return step;
        })
        .filter(step => !(step.type === 'Filter' && step.names.length === 0));
};

// --- Основной компонент многоканального режима ---

export const MultichannelFiltersView: React.FC<FiltersTabProps> = (props) => {
    const { config, samplerate, activeChannelTab, onChannelTabChange } = props;
    const [selectedTab, setSelectedTab] = useState<number | 'common'>(activeChannelTab);
    
    // --- ИСПРАВЛЕНО: Добавляем эффект для синхронизации ---
    // Этот код сработает, когда компонент загрузится или когда prop `activeChannelTab` изменится.
    useEffect(() => {
        setSelectedTab(activeChannelTab);
    }, [activeChannelTab]);

    const [plotData, setPlotData] = useState<MultiChannelPlotData | null>(null);
    const [ignoredFilters, setIgnoredFilters] = useState<string[]>([]);

    const xoverMixerEntry = Object.entries(config.mixers || {}).find(([name, _]) => name.toLowerCase() === XOVER_MIXER_NAME);
    const channelCount = xoverMixerEntry ? xoverMixerEntry[1].channels.out : 0;
    
    // ===== Заменить в MultichannelFiltersView.tsx (весь блок useEffect) =====

    useEffect(() => {
        const handler = setTimeout(() => {
            const channels_to_plot: { name: string, filters: string[] }[] = [];
            const newIgnoredFilterTypes = new Set<string>();

            const UNSUPPORTED_TYPES = ['Limiter'];
            const UNSUPPORTED_SUBTYPES = ['GeneralNotch'];

            for (let i = 0; i < channelCount; i++) {
                const channelLabel = xoverMixerEntry?.[1].labels?.[i] || `Ch ${i + 1}`;
                
                const keyFilters = ['hpf', 'lpf', 'gain', 'delay'].map(type => getKeyFilterName(i, type as any));
                const additionalFilters = findAdditionalFiltersForChannel(config, i);
                const allFiltersForChannel = [...keyFilters, ...additionalFilters];

                const validFiltersForChannel: string[] = [];

                allFiltersForChannel.forEach(name => {
                    const isBypassed = config.pipeline?.some(s => s.type === 'Filter' && s.names.includes(name) && s.bypassed === true);
                    if (isBypassed) return;

                    const filterDef = config.filters?.[name];
                    if (!filterDef) return;

                    let isIgnored = false;
                    let ignoredReason = ''; // Будем хранить причину

                    if (UNSUPPORTED_TYPES.includes(filterDef.type)) {
                        isIgnored = true;
                        ignoredReason = filterDef.type; // Причина - основной тип
                    }
                    
                    if (filterDef.parameters?.type && UNSUPPORTED_SUBTYPES.includes(filterDef.parameters.type)) {
                        isIgnored = true;
                        ignoredReason = filterDef.parameters.type; // Причина - подтип
                    }

                    if (filterDef.type === 'Conv' && (!filterDef.parameters.filename || filterDef.parameters.filename === '')) {
                        isIgnored = true;
                        ignoredReason = 'Conv (пустой)'; // Особая причина для пустого конвольвера
                    }

                    if (isIgnored) {
                        newIgnoredFilterTypes.add(ignoredReason); // Добавляем в Set ТИП, а не имя
                    } else {
                        validFiltersForChannel.push(name);
                    }
                });
                
                channels_to_plot.push({ name: channelLabel, filters: validFiltersForChannel });
            }

            // Обновляем state с типами/подтипами
            setIgnoredFilters(Array.from(newIgnoredFilterTypes));

            // --- Отправка запроса ---
            console.log("Requesting plot data from backend with:", { channels_to_plot });
            
            fetch("/api/evalchannels", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    config: config, 
                    samplerate: samplerate, 
                    channels_to_plot: channels_to_plot 
                })
            })
            .then(res => res.ok ? res.json() : Promise.reject(res))
            .then(data => {
                setPlotData(data);
            })
            .catch(error => {
                console.error("Error fetching plot data:", error);
                // В случае ошибки создаем "пустой" график, чтобы рамка осталась
                const emptyData: MultiChannelPlotData = {
                    name: "Ошибка загрузки данных",
                    f: [20, 20000],
                    traces: []
                };
                setPlotData(emptyData);
            });

        }, 300);

        return () => clearTimeout(handler);

    }, [config, channelCount, xoverMixerEntry, samplerate]); // Добавили samplerate в зависимости

    const commonFilterNames = findCommonFilterNames(config);
    const commonFiltersConfig = useMemo(() => {
        const commonFilterNames = findCommonFilterNames(config);
        const newCommonConfig = cloneDeep(config);
        if (newCommonConfig.filters) {
            Object.keys(newCommonConfig.filters).forEach(name => {
                if (!commonFilterNames.includes(name)) {
                    delete newCommonConfig.filters![name];
                }
            });
        }
        return newCommonConfig;
    }, [config]); 

     return (
        <div className="tabpanel" style={{ width: 'auto', padding: '30px' }}>
            <div className="main-plot-container" style={{marginBottom: "20px"}}>
                {/* --- ИСПРАВЛЕНО: Всегда рендерим Chart, если есть plotData (даже пустой) --- */}
                {plotData ? (
                    <>
                        <Chart data={plotData} selectedChannelIndex={typeof selectedTab === 'number' ? selectedTab : -1}
                          mutedChannels={
                        [...Array(channelCount).keys()].filter(i => 
                            config.filters?.[getKeyFilterName(i, 'gain')]?.parameters.mute === true
                        )
                    } />
                        {/* --- НОВОЕ: Блок с предупреждением --- */}
                        {ignoredFilters.length > 0 && (
                            <div className="plot-warning" style={{ textAlign: 'center', color: 'var(--error-text-color)', fontSize: '0.9em', marginTop: '5px' }}>
                                Фильтры не отображаются на графике: {ignoredFilters.join(', ')}
                            </div>
                        )}
                    </>
                ) : (
                    // Показываем заглушку, пока идет первая загрузка
                    <div style={{ height: '420px', width: '1750px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'var(--box-border)', borderRadius: 'var(--border-radius)'}}>
                        Загрузка графика...
                    </div>
                )}
            </div>

  

            <div className="channel-tabs-container">
                {[...Array(channelCount).keys()].map(i => (
                    <ChannelTabHeader
                      key={i}
                      channelIndex={i}
                      isActive={selectedTab === i}
                      // --- ИСПРАВЛЕНО: Добавляем двойное действие ---
                      onClick={() => {
                        setSelectedTab(i);
                        onChannelTabChange(i);
                      }}
                      {...props}
                    />
                ))}
                <div className={`channel-tab-button ${selectedTab === 'common' ? 'active' : ''}`}
             // --- ИСПРАВЛЕНО: Двойное действие ---
             onClick={() => {
                setSelectedTab('common');
                onChannelTabChange('common');
             }}
          >
                    Общие фильтры
                </div>
            </div>

            {typeof selectedTab === 'number' && <SelectedChannelDetails channelIndex={selectedTab} {...props} />}

            {selectedTab === 'common' && (
                <Box title="Общие фильтры...">
                    <ClassicFiltersView 
                        {...props} 
                        // Передаем всегда свежую, пересчитанную версию
                        config={commonFiltersConfig} 
                    />
                </Box>
            )}
        </div>
    );
};

// --- Внутренние компоненты ---

interface ChannelComponentProps extends FiltersTabProps { channelIndex: number; }

const ChannelTabHeader: React.FC<ChannelComponentProps & { isActive: boolean; onClick: () => void; }> = ({ channelIndex, isActive, onClick, config, updateConfig }) => {
    const gainFilterName = getKeyFilterName(channelIndex, 'gain');
    const delayFilterName = getKeyFilterName(channelIndex, 'delay');
    const gainFilter = config.filters?.[gainFilterName];
    const delayFilter = config.filters?.[delayFilterName];
    const isMuted = gainFilter?.parameters.mute === true;
    
    const xoverMixerEntry = Object.entries(config.mixers || {}).find(([name, _]) => name.toLowerCase() === XOVER_MIXER_NAME);
    const xoverMixer = xoverMixerEntry ? xoverMixerEntry[1] : undefined;
    const channelLabel = xoverMixer?.labels?.[channelIndex] || null;
    const tabTitle = `Ch ${channelIndex + 1}` + (channelLabel ? ` - ${channelLabel}` : '');

    const borderColor = CHANNEL_COLORS[channelIndex % CHANNEL_COLORS.length];
    
    const updateKeyParam = (type: 'gain' | 'delay', param: string, value: any) => { const filterName = getKeyFilterName(channelIndex, type); updateConfig(cfg => { if (cfg.filters?.[filterName]) { (cfg.filters[filterName].parameters as any)[param] = value; } }); };

    return (
        <div 
            className={`channel-tab-button ${isActive ? 'active' : ''} ${isMuted ? 'channel-muted' : ''}`}
        >
            <div 
                className="channel-tab-title" 
                onClick={onClick}
                style={{ borderColor: borderColor }}
            >
                {tabTitle}
            </div>
            <div className="channel-tab-controls">

                {delayFilter && <FloatOption desc="Delay, ms" 
                tooltip="Задержка для этого канала" 
                value={delayFilter.parameters.delay} 
                onChange={val => updateKeyParam('delay', 'delay', val)} 
                withControls={true} 
                step={0.1}
                forceDecimals={1} 
                />}

                {gainFilter && <FloatOption desc="Gain, dB" 
                tooltip="Общее усиление для этого канала" 
                value={gainFilter.parameters.gain} 
                onChange={val => updateKeyParam('gain', 'gain', val)} 
                withControls={true}  
                step={0.5}
                forceDecimals={1} 
                />}

                <div className="channel-tab-buttons">
                    {gainFilter && <MdiButton icon={mdiVolumeOff} highlighted={gainFilter.parameters.mute} onClick={() => updateKeyParam('gain', 'mute', !gainFilter.parameters.mute)} tooltip="Mute" />}
                    {gainFilter && <MdiButton icon={mdiPlusMinusVariant} highlighted={gainFilter.parameters.inverted} onClick={() => updateKeyParam('gain', 'inverted', !gainFilter.parameters.inverted)} tooltip="Инвертировать полярность" />}
                </div>
            </div>
        </div>
    );
};


const SelectedChannelDetails: React.FC<ChannelComponentProps> = (props) => {
    const { config, channelIndex } = props;
    const gainFilterName = getKeyFilterName(channelIndex, 'gain');
    const isMuted = config.filters?.[gainFilterName]?.parameters.mute === true;
    
    const xoverMixer = Object.entries(config.mixers || {}).find(([name, _]) => name.toLowerCase() === XOVER_MIXER_NAME)?.[1];
    const title = `Настройки фильтров для ${xoverMixer?.labels?.[channelIndex] || `канала ${channelIndex + 1}`}`;

    // ИСПРАВЛЕНО: Оборачиваем Box в div, которому передаем динамический класс
    return (
        <div className={isMuted ? 'channel-muted' : ''} style={{ width: '100%', height: '100%' }}>
                <div className="channel-details-grid">
                    <CrossoverBlock {...props} />
                    <div className="additional-filters-wrapper">
                        
                        <AdditionalFiltersRow {...props} />
                    </div>
                </div>

        </div>
    );
};

// ===== Заменить в MultichannelFiltersView.tsx (компонент CrossoverBlock) =====

// ===== Заменить в MultichannelFiltersView.tsx (компонент CrossoverBlock) =====

const CrossoverBlock: React.FC<ChannelComponentProps> = ({ channelIndex, config, updateConfig }) => {
    const hpfName = getKeyFilterName(channelIndex, 'hpf');
    const lpfName = getKeyFilterName(channelIndex, 'lpf');
    const hpf = config.filters?.[hpfName];
    const lpf = config.filters?.[lpfName];
    
    const isBypassed = (name: string) => config.pipeline?.some(s => s.type === 'Filter' && s.names.includes(name) && s.bypassed === true);

    const handleBypassToggle = (filterName: string) => {
        updateConfig(cfg => {
            toggleFilterBypassInPipeline(cfg, filterName, !isBypassed(filterName));
        });
    };
    
    const updateKeyParam = (type: 'hpf' | 'lpf', param: string, value: any) => {
        const filterName = getKeyFilterName(channelIndex, type);
        updateConfig(cfg => {
            if (cfg.filters?.[filterName]) {
                const currentParams = cfg.filters[filterName].parameters;
                cfg.filters[filterName].parameters = {
                    ...currentParams,
                    [param]: value
                };
            }
        });
    };

    const isFrequencyChangeDangerous = (oldVal: number, newVal: number): boolean => {
        if (newVal < 1 || oldVal < 1) return false;
        const ratio = oldVal > newVal ? oldVal / newVal : newVal / oldVal;
        const octaveDifference = Math.log2(ratio);
        return octaveDifference > 2.0;
    };
    
    if (!hpf || !lpf) return <div>Ошибка: Ключевые фильтры кроссовера не найдены!</div>;

    return (
        <div className="crossover-block-flex">
            <div className="crossover-labels">
                <div className="crossover-label-header">&nbsp;</div>
                <div className="crossover-label">Тип</div>
                <div className="crossover-label">Порядок</div>
                <div className="crossover-label">Частота</div>
            </div>
            
            <div className={`crossover-column ${isBypassed(hpfName) ? 'filter-bypassed' : ''}`}>
                <div className="crossover-column-header">
                    <span>ФВЧ (HPF)</span>
                    <MdiButton icon={isBypassed(hpfName) ? mdiToggleSwitchOffOutline : mdiToggleSwitch} highlighted={isBypassed(hpfName)} onClick={() => handleBypassToggle(hpfName)} tooltip="Bypass" />
                </div>
                <EnumOption desc="" tooltip="Тип фильтра" value={hpf.parameters.type} options={['LinkwitzRileyHighpass', 'ButterworthHighpass']} onChange={val => updateKeyParam('hpf', 'type', val)} />
                <IntOption desc="" tooltip="Порядок фильтра" value={hpf.parameters.order} onChange={val => updateKeyParam('hpf', 'order', val)} withControls={true} step={1} />
                <div className="input-with-unit">
                    <FloatOption desc="" tooltip="Частота среза" value={hpf.parameters.freq} onChange={val => updateKeyParam('hpf', 'freq', val)} withControls={true} step={10} isDangerousChange={isFrequencyChangeDangerous} />
                    <span className="unit-label">Гц</span>
                </div>
            </div>

            <div className={`crossover-column ${isBypassed(lpfName) ? 'filter-bypassed' : ''}`}>
                 <div className="crossover-column-header">
                    <span>ФНЧ (LPF)</span>
                    <MdiButton icon={isBypassed(lpfName) ? mdiToggleSwitchOffOutline : mdiToggleSwitch} highlighted={isBypassed(lpfName)} onClick={() => handleBypassToggle(lpfName)} tooltip="Bypass" />
                </div>
                <EnumOption desc="" tooltip="Тип фильтра" value={lpf.parameters.type} options={['LinkwitzRileyLowpass', 'ButterworthLowpass']} onChange={val => updateKeyParam('lpf', 'type', val)} />
                <IntOption desc="" tooltip="Порядок фильтра" value={lpf.parameters.order} onChange={val => updateKeyParam('lpf', 'order', val)} withControls={true} step={1} />
                <div className="input-with-unit">
                     <FloatOption desc="" tooltip="Частота среза" value={lpf.parameters.freq} onChange={val => updateKeyParam('lpf', 'freq', val)} withControls={true} step={10} isDangerousChange={isFrequencyChangeDangerous} />
                    <span className="unit-label">Гц</span>
                </div>
            </div>
        </div>
    );
};

const AdditionalFiltersRow: React.FC<ChannelComponentProps> = (props) => {
    const { channelIndex, config, updateConfig } = props;
    const additionalFilters = findAdditionalFiltersForChannel(config, channelIndex);
    
    const addPeq = () => { updateConfig(cfg => { const newName = newFilterName(cfg.filters); if (!cfg.filters) cfg.filters = {}; const newPeq: Filter = {
                type: 'Biquad',
                // Теперь мы присваиваем строку полю, которое ожидает `string | null`, что корректно.
                description: `Filter for ch ${channelIndex + 1}`,
                parameters: { ...DefaultFilterParameters.Biquad.Peaking }
            };
            
            cfg.filters[newName] = newPeq;
            addFilterToPipeline(cfg, newName, channelIndex);
        });
    };
    const handleRemove = (filterName: string) => { updateConfig(cfg => { removeFilterFromPipeline(cfg, filterName); removeFilter(cfg, filterName); }); };
    
    // ИСПРАВЛЕНО: Добавляем функцию isFreeFilterName, необходимую для FilterView
    const isFreeFilterName = (name: string): boolean => !config.filters || !Object.keys(config.filters).includes(name);

    return (
       
            <div className="additional-filters-row">
                {additionalFilters.map(filterName => (
                    <div key={filterName} className="additional-filter-item">
                        <FilterView
                            {...props}
                            name={filterName}
                            filter={config.filters![filterName]}
                            errors={props.errors.forSubpath('filters', filterName)}
                            updateFilter={(update: Update<Filter>) => updateConfig(cfg => update(cfg.filters![filterName]))}
                             rename={(newName: string) => {
                                // --- ПРЕДОХРАНИТЕЛЬ ---
                                if (!config.filters?.[filterName]) {
                                    return; // Если старого имени уже нет, ничего не делаем
                                }
                                updateConfig(cfg => renameFilter(cfg, filterName, newName));
                            }}
                            remove={() => handleRemove(filterName)}
                            isFreeFilterName={isFreeFilterName} // ИСПРАВЛЕНО: Передаем требуемый prop
                            // Заглушки для пропсов, которые могут понадобиться FilterView
                            availableCoeffFiles={[]} 
                            updateAvailableCoeffFiles={() => {}} 
                        />
                    </div>
                ))}
                <AddButton onClick={addPeq} tooltip="Добавить параметрический эквалайзер (PEQ)" />
            </div>

    );
};