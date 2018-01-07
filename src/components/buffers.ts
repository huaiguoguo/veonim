import { list, action, current, getCurrent, cmd } from '../core/neovim'
import { h, app, Actions, ActionCaller } from '../ui/uikit'
import { VimBuffer } from '../core/vim-functions'
import * as setiIcon from '../styles/seti-icons'
import { simplifyPath } from '../support/utils'
import { Plugin, Row } from '../styles/common'
import Input from '../components/text-input'
import { basename, dirname } from 'path'
import { filter } from 'fuzzaldrin-plus'

interface BufferInfo {
  name: string,
  base: string,
  modified?: boolean,
  dir: string,
  duplicate: boolean,
}

interface State {
  val: string,
  buffers: BufferInfo[],
  cache: BufferInfo[],
  vis: boolean,
  ix: number,
}

const getVimBuffers = async () => {
  const buffers = await list.buffers
  const currentBufferId = (await getCurrent.buffer).id

  return await Promise.all(buffers.map(async b => ({
    name: await b.name,
    cur: b.id === currentBufferId,
    mod: await b.getOption('modified'),
  })))
}

const getBuffers = async (cwd: string): Promise<BufferInfo[]> => {
  const buffers = await getVimBuffers()
  if (!buffers) return []
  
  return buffers
    .filter((m: VimBuffer) => !m.cur)
    .map(({ name, mod }) => ({
      name,
      base: basename(name),
      modified: mod,
      dir: simplifyPath(dirname(name), cwd)
    }))
    .map((m, ix, arr) => ({ ...m, duplicate: arr.some((n, ixf) => ixf !== ix && n.base === m.base) }))
    .map(m => ({ ...m, name: m.duplicate ? `${m.dir}/${m.base}` : m.base }))
}

const state: State = {
  val: '',
  buffers: [],
  cache: [],
  vis: false,
  ix: 0,
}

const view = ($: State, actions: ActionCaller) => Plugin.default('buffers', $.vis, [
  ,Input({
    ...actions,
    val: $.val,
    focus: true,
    icon: 'list',
    desc: 'switch buffer',
  })

  ,h('div', $.buffers.map((f, key) => Row.files({ key, activeWhen: key === $.ix }, [
    ,setiIcon.file(f.name)

    ,h('span', {
      render: f.duplicate,
      style: { color: '#666' },
    }, `${f.dir}/`)

    ,h('span', f.duplicate ? f.base : f.name),
  ])))

])

const a: Actions<State> = {}

a.select = (s, a) => {
  if (!s.buffers.length) return a.hide()
  const { name } = s.buffers[s.ix]
  if (name) cmd(`b ${name}`)
  a.hide()
}

a.change = (s, _a, val: string) => ({ val, buffers: val
  ? filter(s.cache, val, { key: 'name' }).slice(0, 10)
  : s.cache.slice(0, 10)
})

a.show = (_s, _a, buffers: BufferInfo[]) => ({ buffers, cache: buffers, vis: true })
a.hide = () => ({ val: '', vis: false, ix: 0 })
a.next = s => ({ ix: s.ix + 1 > Math.min(s.buffers.length - 1, 9) ? 0 : s.ix + 1 })
a.prev = s => ({ ix: s.ix - 1 < 0 ? Math.min(s.buffers.length - 1, 9) : s.ix - 1 })

const ui = app({ state, view, actions: a })

action('buffers', async () => ui.show(await getBuffers(current.cwd)))
