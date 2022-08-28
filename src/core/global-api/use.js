/* @flow */

import { toArray } from '../util/index'

export function initUse (Vue: GlobalAPI) {
  Vue.use = function (plugin: Function | Object) {
    // 不会重复注册同一个组件
    const installedPlugins = (this._installedPlugins || (this._installedPlugins = []))
    if (installedPlugins.indexOf(plugin) > -1) {
      return this
    }

    // additional parameters
    const args = toArray(arguments, 1)
    args.unshift(this)
    if (typeof plugin.install === 'function') {
      // plugin是对象
      plugin.install.apply(plugin, args)
    } else if (typeof plugin === 'function') {
      // plugin是函数
      plugin.apply(null, args)
    }
    installedPlugins.push(plugin)
    return this
  }
}
