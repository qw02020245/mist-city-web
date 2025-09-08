import React, { useEffect, useMemo, useRef, useState } from "react";

/* --- Scenes (editable) --- */
const SCENES = {
  intro: {
    id: "intro",
    text: `午夜的霧城像一台尚未關機的伺服器，
風聲裡混著資料包的嘯鳴。你是自由的資料潛行者—零號。
今晚的任務：潛入巨擘【赫墨拉】的邊緣機房，竊出一段足以改寫城市命運的密鑰。`,
    choices: [
      { label: "檢查裝備", effects: { morale: +3 }, go: "kit" },
      { label: "直接出發到機房外", effects: { morale: -1 }, go: "gate" },
    ],
  },
  kit: {
    id: "kit",
    text: `你翻點背包，掃過舊型解碼器與一片一次性 S-閃片。
S-閃片：一次性繞過單一等級防火牆`,
    choices: [
      { label: "帶上 S-閃片", effects: { itemAdd: "S-閃片" }, go: "gate", require: (s) => !s.inventory.includes("S-閃片") },
      { label: "關上背包，動身", go: "gate" },
    ],
  },
  gate: {
    id: "gate",
    text: `你來到機房外。鐵門後是層層防火牆的低鳴。
左邊是維修管道，右邊是保全崗哨。`,
    choices: [
      { label: "走維修管道（潛行）", effects: { morale: +1 }, go: (s) => (s.morale >= 5 ? "duct_easy" : "duct_hard") },
      { label: "賄賂崗哨（-20 點數）", require: (s) => s.credits >= 20, effects: { credits: -20 }, go: "lobby" },
      { label: "在附近搜索可利用物資", go: "scavenge" },
    ],
  },
  scavenge: {
    id: "scavenge",
    text: `你在垃圾槽後找到一卷光纖與半包能量棒。補充了一點體力，也想到一個點子。`,
    choices: [
      { label: "恢復 2 生命", effects: { hp: +2 }, go: "gate" },
      { label: "把光纖改造成干擾器（+S-閃片）", require: (s) => !s.inventory.includes("S-閃片"), effects: { itemAdd: "S-閃片" }, go: "gate" },
    ],
  },
  duct_easy: {
    id: "duct_easy",
    text: `管道寬大而安靜。你輕鬆繞過感測器，來到核心端口前。`,
    choices: [{ label: "連接端口，開始入侵", go: "hack1" }],
  },
  duct_hard: {
    id: "duct_hard",
    text: `狹窄的管道充滿粉塵。你不小心觸動了紅外線，警報短鳴後熄滅。`,
    choices: [
      { label: "加快腳步（-2 生命）", effects: { hp: -2 }, go: "hack1" },
      { label: "退回去，換條路走", go: "gate" },
    ],
  },
  lobby: {
    id: "lobby",
    text: `崗哨悶哼一聲收下點數，低聲說：『三分鐘。』你踩著地毯進入大廳，主機在內室低鳴。`,
    choices: [{ label: "進入內室", go: "hack1" }, { label: "趁機搜尋抽屜（有風險）", go: "drawers" }],
  },
  drawers: {
    id: "drawers",
    text: `你迅速翻找，找到一枚舊識別章與 30 點數，但保全似乎回頭了。`,
    choices: [
      { label: "拿走一切（+30 點數，-1 士氣）", effects: { credits: +30, morale: -1 }, go: "hack1" },
      { label: "只拿識別章（+士氣）", effects: { morale: +2 }, go: "hack1" },
    ],
  },
  hack1: {
    id: "hack1",
    text: `核心端口亮起。三級防火牆像海浪一樣推來。`,
    choices: [
      { label: "使用 S-閃片（消耗）", require: (s) => s.inventory.includes("S-閃片"), effects: { itemRemove: "S-閃片", morale: +1 }, go: "vault" },
      { label: "硬破（檢定：士氣 6+ 成功，失敗 -2 生命）", go: (s) => (s.morale >= 6 ? "vault" : "hack_fail") },
      { label: "暫停，先觀察流量特徵", effects: { morale: +1 }, go: "hack1" },
    ],
  },
  hack_fail: {
    id: "hack_fail",
    text: `防火牆反咬，你的指尖被電得發麻。紅色字體在視網膜閃爍。`,
    choices: [{ label: "咬牙再上（-2 生命）", effects: { hp: -2 }, go: "vault" }, { label: "撤退", go: "gate" }],
  },
  vault: {
    id: "vault",
    text: `你潛入資料金庫。目標密鑰在透明容器中慢慢旋轉。要帶走它，系統會觸發追蹤。`,
    choices: [{ label: "竊取密鑰，準備逃離（+勝利條件）", effects: { morale: +1 }, go: "escape" }, { label: "改寫部分公文資料（+50 點數）", effects: { credits: +50 }, go: "escape" }],
  },
  escape: {
    id: "escape",
    text: `離開時，保全系統甦醒。你得選一條路。`,
    choices: [
      { label: "走人潮多的大街（檢定：生命 5+）", go: (s) => (s.hp >= 5 ? "win" : "lose") },
      { label: "再次走維修管道（若有 S-閃片自動成功）", go: (s) => (s.inventory.includes("S-閃片") ? "win" : "duct_hard2") },
    ],
  },
  duct_hard2: {
    id: "duct_hard2",
    text: `管道內熱浪翻湧。你聽見遠處有人追來。`,
    choices: [{ label: "硬撐到底（-3 生命）", effects: { hp: -3 }, go: (s) => (s.hp > 0 ? "win" : "lose") }, { label: "丟棄裝備換速度（-20 點數）", effects: { credits: -20 }, go: "win" }],
  },
  win: {
    id: "win",
    end: "win",
    text: `你與聯絡人會合。霧城的天際線被第一縷黎明切開。
你交出密鑰，拿回一個承諾：資料將公開於眾。這座城市或許還有救。`,
    choices: [{ label: "重新開始", go: "__restart__" }],
  },
  lose: {
    id: "lose",
    end: "lose",
    text: `警報與腳步聲交疊。你跌坐在冷風裡，終端機的光在你臉上忽明忽暗。任務失敗。`,
    choices: [{ label: "再來一次", go: "__restart__" }],
  },
};

/* --- Utilities --- */
function clamp(n, a, b){return Math.min(b, Math.max(a, n))}
function nowStamp(){return new Date().toLocaleTimeString()}

/* --- App --- */
export default function App(){
  const fresh = useMemo(()=>({hp:7,credits:40,morale:4,inventory:[],nodeId:"intro",log:[],seed:Date.now()}),[])
  const [state,setState] = useState(() => {
    try{
      const raw = localStorage.getItem("mist_city_save_v1")
      return raw ? JSON.parse(raw) : fresh
    }catch(e){return fresh}
  })
  useEffect(()=>{localStorage.setItem("mist_city_save_v1", JSON.stringify(state))},[state])

  const scene = SCENES[state.nodeId]
  const logEndRef = useRef(null)

  useEffect(()=>{logEndRef.current?.scrollIntoView({behavior:"smooth"})},[state.nodeId,state.log.length])

  function applyChoice(c){
    setState(prev=>{
      let next = {...prev}
      // apply effects
      if(c.effects){
        const {hp,credits,morale,itemAdd,itemRemove} = c.effects
        if(typeof hp === "number") next.hp = clamp(next.hp + hp, 0, 10)
        if(typeof credits === "number") next.credits = Math.max(0, next.credits + credits)
        if(typeof morale === "number") next.morale = clamp(next.morale + morale, 0, 10)
        if(itemAdd) next.inventory = Array.from(new Set([...next.inventory, itemAdd]))
        if(itemRemove) next.inventory = next.inventory.filter(x=>x!==itemRemove)
      }
      // determine next node
      const target = typeof c.go === "function" ? c.go(next) : c.go
      if(target === "__restart__"){
        next = {...fresh, seed:Date.now()}
      }else{
        next.nodeId = target
      }
      if(next.hp <= 0 && next.nodeId !== "lose"){
        next.nodeId = "lose"
      }
      next.log = [...next.log, `[${nowStamp()}] ${scene.id} -> ${typeof c.go==="string"?c.go:"(動態)"} `]
      return next
    })
  }

  function reset(){
    setState({...fresh, seed: Date.now()})
  }

  function exportSave(){
    const blob = new Blob([JSON.stringify(state,null,2)],{type:"application/json"})
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `mist-city-save-${new Date().toISOString().slice(0,19)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function importSave(e){
    const file = e.target.files?.[0]; if(!file) return;
    const fr = new FileReader()
    fr.onload = ()=>{ try{ setState(JSON.parse(String(fr.result))) }catch(err){ alert("匯入失敗：格式錯誤") } }
    fr.readAsText(file)
  }

  const visibleChoices = (scene.choices || []).filter(c => c.require ? c.require(state) : true)

  return (
    <div className="app" role="main">
      <div className="header">
        <div>
          <div className="title">霧城微光 — 文字冒險</div>
          <div className="small">簡易可部署版（Vite + React）</div>
        </div>
        <div className="stats">
          <div className="stat"><div className="small">生命</div><div className="badge">{state.hp}</div></div>
          <div className="stat"><div className="small">士氣</div><div className="badge">{state.morale}</div></div>
          <div className="stat"><div className="small">點數</div><div className="badge">{state.credits}</div></div>
        </div>
      </div>

      <div className="scene" aria-live="polite">
        <div dangerouslySetInnerHTML={{__html: scene.text.replace(/\n/g,"<br/>")}} />
      </div>

      <div className="choices">
        {visibleChoices.map((c, i) => (
          <button key={i} className="btn" onClick={()=>applyChoice(c)}>{c.label}</button>
        ))}
      </div>

      <div style={{display:"flex",gap:10,marginTop:12,alignItems:"center"}}>
        <div style={{flex:1}}>
          <div className="log">
            {state.log.map((l,idx)=>(<div key={idx}>{l}</div>))}
            <div ref={logEndRef} />
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <button className="btn" onClick={reset}>重開</button>
          <button className="btn" onClick={exportSave}>匯出存檔</button>
          <label className="btn" style={{cursor:"pointer"}}>
            匯入
            <input type="file" accept="application/json" onChange={importSave} style={{display:"none"}} />
          </label>
        </div>
      </div>

      <div className="footer">可把這個資料夾部署到 Vercel / Netlify / GitHub Pages。</div>
    </div>
  )
}
