# 安装到其他电脑的 DSH

这个插件是**纯前端 + 空 Host 半边**的 Cordis bundle：零依赖、无构建步骤、不发网络请求。只要目标机器用的是同一个聊天渲染结构（DSH ≥ `0.2.2-rc.5`）就能用。

三种装法，任选一种。

## 一、装本地 tgz（最省事，不需要 npm 账号）

1. 把 `dsh-fold-answers-0.2.0.tgz` 拷到目标机器，例如 `C:\Users\<你>\Downloads\dsh-fold-answers-0.2.0.tgz`
2. 在 DSH 里（任一会话）让 agent 执行：

```
plugin_manager install_bundle target=file:C:\Users\<你>\Downloads\dsh-fold-answers-0.2.0.tgz
```

或者用界面：**设置 → 插件 → 添加插件**，把上面那个 `file:...` 路径填进去。

3. **完全退出并重开 DSH**（客户端 bundle 要重新进页面引导图；仅刷新页面不一定够）。

## 二、从 GitHub 装

先把整个目录推到一个仓库（`package.json`、`client.js`、`index.js`、`cordis.patch.yml` 四个文件就够），然后：

```
plugin_manager install_bundle target=github:<你的用户名>/<仓库名>
```

## 三、发到 npm 再装（适合给多人用）

在插件目录：

```
pnpm publish --access public
```

名字 `dsh-fold-answers` 如果被占用就改成带作用域的，例如 `@你的名字/dsh-fold-answers`（同时改 `package.json` 的 `name` 和 `client.js` 里 `__ModuleLoader__.load({ id: ... })` 的 id，两处必须一致）。

之后别人：

```
plugin_manager install_bundle target=dsh-fold-answers
```

## 四、直接拷目录（开发用）

把整个目录拷过去，然后：

```
plugin_manager install_bundle target=link:C:\path\to\dsh-fold-answers
```

`link` 是指向源目录的软链，改完文件重开就生效，适合继续改代码。

## 装完应该看到什么

助手回答下方的动作条里多两个图标（在「复制 / 赞 / 踩」之后、「分享」之前）：

- **↑ / ↓**：折叠 / 展开这一轮的收尾回答，折叠后带浅色底
- **两层方块**：折叠 / 展开这一轮的「已编辑 N 个文件」卡片（该轮没有卡片时不显示）

折叠后回答变成一行 `已折叠 · <开头几十字>`，点它展开；状态存在浏览器本地，按会话区分。

## 排错

| 现象 | 处理 |
|---|---|
| 装完没变化 | 完全退出重开 DSH（不是只刷新页面） |
| 图标出来了但点了没反应 | 检查 DSH 版本是否 ≥ `0.2.2-rc.5`；更老的版本聊天行 DOM 结构不同 |
| 折叠卡片没反应 | 中断的轮次没有 `data-turn-tail`，不提供卡片折叠 |
| 装了两个同名包 | 先 `remove_bundle` 再装 |

## 卸载

```
plugin_manager remove_bundle target=dsh-fold-answers
```

## 依赖的聊天行 DOM 约定

- `[data-chat-flow-kind="assistant-step"]` + `[data-chat-node-key]`：回答行及其稳定 key
- `[data-turn-tail]`：轮次尾栏（卡片与动作条的容器）
- `[data-chat-flow-kind="turn-process"]`：过程分组，内部回答不注入

DSH 换版本后如果官方改了这些属性名，插件会静默失效（不会报错、不影响聊天）。到时候改 `client.js` 顶部的四个常量即可。
