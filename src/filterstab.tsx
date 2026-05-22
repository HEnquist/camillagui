// ===== Файл: src/filterstab.tsx (Обновлённая версия) =====

import React from "react"
import { Config } from "./camilladsp/config"
import { Update } from "./utilities/common"
import { Errors } from "./utilities/errors"

// Импортируем два наших новых компонента
import { ClassicFiltersView } from './ClassicFiltersView'
import { MultichannelFiltersView } from './MultichannelFiltersView'

// Определяем пропсы, которые будут передаваться дальше
export interface FiltersTabProps {
  config: Config
  samplerate: number
  channels: Promise<number>
  coeffDir: string
  updateConfig: (update: Update<Config>) => void
  errors: Errors
  activeChannelTab: number | 'common'
  onChannelTabChange: (tabIndex: number | 'common') => void
}

/**
 * Проверяет наличие микшера 'xover' в конфигурации.
 * @param config - Текущая конфигурация CamillaDSP.
 * @returns true, если микшер найден, иначе false.
 */
const hasXoverMixer = (config: Config): boolean => {
  if (!config.mixers) {
    return false;
  }
  // Поиск без учета регистра
  return Object.keys(config.mixers).some(name => name.toLowerCase() === 'xover');
};

/**
 * Новый FiltersTab - теперь это просто "диспетчер".
 * Он решает, какой вид интерфейса фильтров показать: классический или многоканальный.
 */
export class FiltersTab extends React.Component<FiltersTabProps> {
  render() {
    // Проверяем, существует ли микшер 'xover'
    if (hasXoverMixer(this.props.config)) {
      // Если да, показываем новый многоканальный интерфейс
      return <MultichannelFiltersView {...this.props} />;
    } else {
      // Если нет, показываем старый добрый классический интерфейс
      return <ClassicFiltersView {...this.props} />;
    }
  }
}
