/* @flow */

import config from '../config'
import { initProxy } from './proxy'
import { initState } from './state'
import { initRender } from './render'
import { initEvents } from './events'
import { mark, measure } from '../util/perf'
import { initLifecycle, callHook } from './lifecycle'
import { initProvide, initInjections } from './inject'
import { extend, mergeOptions, formatComponentName } from '../util/index'

let uid = 0
//                         传入vue构造函数
export function initMixin (Vue: Class<Component>) {
  // 负责 Vue 的初始化过程
  Vue.prototype._init = function (options?: Object) {
    // vm = this = vue实例化对象
    const vm: Component = this
    // 每个 vue 实例都有一个 _uid, 并且是依次递增的
    vm._uid = uid++
    // ---------- 初始化性能度量  start----------
    let startTag, endTag
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      startTag = `vue-perf-start:${vm._uid}`
      endTag = `vue-perf-end:${vm._uid}`
      mark(startTag)
    }
    // ---------- 初始化性能度量  ing----------

    // a flag to avoid this being observed
    vm._isVue = true
    // 处理组件配置项
    // merge options
    if (options && options._isComponent) {
      // optimize internal component instantiation
      // since dynamic options merging is pretty slow, and none of the
      // internal component options needs special treatment.
      // 子组件性能优化，将组件配置对象上的一些深层次属性放到 vm.$options 选项中，提高代码效率
      initInternalComponent(vm, options)
    } else {
      // 根组件逻辑。合并选项，将全局配置选项合并到根组件的局部配置上

      /**
       * 选项合并，发生在三个地方
       *  1. Vue.component(CompName,Comp) 合并 Vue 内置的全局组件和用户自己注册的全局组件，最终会放到全局的
       *      components选项中
       *  2. 注册局部组件 {components: {xxx}}。执行编译器生成的render函数时做了选项合并。会合并全局配置项到
       *      组件局部配置上
       *  3. 根组件
       */
      vm.$options = mergeOptions(
        resolveConstructorOptions(vm.constructor),
        options || {},
        vm
      )
    }
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      initProxy(vm)
    } else {
      vm._renderProxy = vm
    }
    // expose real self
    vm._self = vm

    /**
     * important
     */
    // 组件关系属性的初始化，$parent $root $children  $refs
    initLifecycle(vm)
    /**
     * 初始化自定义事件
     *  <child @close="close"></child>
     *  子组件this.$emit('close')，@close="close" 会被编译成 this.$on('close',function(){})
     *    子组件监听close事件，不是父组件
     *  事件的派发和监听者都是子组件本身
     */
    initEvents(vm)
    // 初始化插槽，获取 this.$slots, 定义 this._c, 即createElement方法
    initRender(vm)
    // 执行beforeCreate函数
    callHook(vm, 'beforeCreate')
    // 初始化inject
    initInjections(vm) // resolve injections before data/props
    // 响应式，处理props、methods、data、computed、watch
    initState(vm)
    // 解析组件配置项上的 provide 对象，将其挂载到 vm._provided 属性上
    initProvide(vm) // resolve provide after data/props
    // 最早获取数据
    callHook(vm, 'created')
    // ---------- 初始化性能度量  ing----------
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      vm._name = formatComponentName(vm, false)
      mark(endTag)
      measure(`vue ${vm._name} init`, startTag, endTag)
    }
    // ---------- 初始化性能度量  end----------
    // 如果发现配置项上有 el 选项，则自动调用 $mount 方法，不用手动调用
    if (vm.$options.el) {
      vm.$mount(vm.$options.el)
    }
  }
}
// 性能优化，打平配置对象上的属性，减少运行时频繁查找原型链属性
export function initInternalComponent (vm: Component, options: InternalComponentOptions) {
  // 基于构造函数上的配置对象创建vm.$options
  // Object.create()方法创建一个新对象，使用现有的对象来提供新创建的对象的__proto__
  const opts = vm.$options = Object.create(vm.constructor.options)
  // doing this because it's faster than dynamic enumeration.
  const parentVnode = options._parentVnode
  opts.parent = options.parent
  opts._parentVnode = parentVnode

  const vnodeComponentOptions = parentVnode.componentOptions
  opts.propsData = vnodeComponentOptions.propsData
  opts._parentListeners = vnodeComponentOptions.listeners
  opts._renderChildren = vnodeComponentOptions.children
  opts._componentTag = vnodeComponentOptions.tag

  if (options.render) {
    opts.render = options.render
    opts.staticRenderFns = options.staticRenderFns
  }
}
// 从构造函数上解析配置项，合并基类选项
export function resolveConstructorOptions (Ctor: Class<Component>) {
  let options = Ctor.options
  if (Ctor.super) {
    // 存在基类，递归解析基类构造函数的选项
    const superOptions = resolveConstructorOptions(Ctor.super)
    const cachedSuperOptions = Ctor.superOptions
    if (superOptions !== cachedSuperOptions) {
      // super option changed,
      // need to resolve new options.
      // 基类构造函数选项已经发生改变，需要重新设置
      Ctor.superOptions = superOptions
      // check if there are any late-modified/attached options (#4976)
      // 检查 Ctor.options 上是否有任何后期修改/附加的选项
      const modifiedOptions = resolveModifiedOptions(Ctor)
      // update base extend options
      // 如果存在被修改或增加的选项，合并他们
      if (modifiedOptions) {
        extend(Ctor.extendOptions, modifiedOptions)
      }
      options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)
      if (options.name) {
        options.components[options.name] = Ctor
      }
    }
  }
  return options
}
// 解析构造函数选项中后续被修改或者增加的选项
function resolveModifiedOptions (Ctor: Class<Component>): ?Object {
  let modified
  // 构造函数选项
  const latest = Ctor.options
  // 密封的构造函数选项，备份
  const sealed = Ctor.sealedOptions
  // 对比两个选项，记录不一致的选项
  for (const key in latest) {
    if (latest[key] !== sealed[key]) {
      if (!modified) modified = {}
      modified[key] = latest[key]
    }
  }
  return modified
}
