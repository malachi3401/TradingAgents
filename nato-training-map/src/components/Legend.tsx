export default function Legend() {
  const row = 'flex items-center gap-2 py-0.5'
  const swatch = 'inline-block h-3 w-5 rounded-sm border border-black/30'
  const line = 'inline-block h-0.5 w-5'

  return (
    <div className="absolute bottom-4 left-3 z-10 w-56 rounded border border-edge bg-panel/95 p-3 text-[11px] text-gray-300 shadow-xl">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
        Legend — Maplewood TA (fictional)
      </div>
      <div className={row}><span className={swatch} style={{ background: '#c4dcb0' }} /> Forest / woodline</div>
      <div className={row}><span className={swatch} style={{ background: '#efe9d2' }} /> Open ground</div>
      <div className={row}><span className={swatch} style={{ background: '#9fc4b8' }} /> Marsh</div>
      <div className={row}><span className={swatch} style={{ background: '#a8cfe0' }} /> Lake / river</div>
      <div className={row}><span className={line} style={{ background: '#c8823c' }} /> Contour (10 m)</div>
      <div className={row}><span className={line} style={{ background: '#e8b04a', height: 3 }} /> Paved road</div>
      <div className={row}><span className={line} style={{ background: '#ffffff', height: 2 }} /> Gravel road</div>
      <div className={row}><span className={line} style={{ background: '#7a6248', borderBottom: '1px dashed #7a6248' }} /> Trail</div>
      <div className={row}><span className={line} style={{ background: '#444' }} /> Railway</div>
      <div className={row}><span className={line} style={{ background: '#c05050' }} /> Range / TA boundary</div>
      <div className={row}><span className={line} style={{ background: '#3d6ea5' }} /> MGRS grid (1 km)</div>
      <div className="mt-1 border-t border-edge pt-1 text-[10px] text-gray-500">
        Unit symbols per NATO APP-6(D); control measures per APP-6(D) ch. 10 conventions.
      </div>
    </div>
  )
}
