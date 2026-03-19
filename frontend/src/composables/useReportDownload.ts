import { ref } from 'vue'
import { ElMessage } from 'element-plus'

export function useReportDownload() {
  const downloading = ref(false)

  async function downloadPDF(container: HTMLElement, projectName: string) {
    downloading.value = true
    ElMessage.info('正在生成 PDF 报告，请稍候...')

    try {
      const [html2canvasModule, jsPDFModule] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ])
      const html2canvas = html2canvasModule.default
      const { jsPDF } = jsPDFModule

      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
      })

      const imgWidth = canvas.width
      const imgHeight = canvas.height

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      })

      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()
      const margin = 10
      const contentWidth = pdfWidth - margin * 2
      const contentHeight = (imgHeight * contentWidth) / imgWidth

      addHeader(pdf, projectName, pdfWidth)

      const headerOffset = 20
      let remainingHeight = contentHeight
      let sourceY = 0
      let isFirstPage = true

      while (remainingHeight > 0) {
        if (!isFirstPage) {
          pdf.addPage()
          addHeader(pdf, projectName, pdfWidth)
        }

        const availableHeight = pdfHeight - margin - (isFirstPage ? headerOffset : 20)
        const sliceHeight = Math.min(remainingHeight, availableHeight)
        const sourceSliceHeight = (sliceHeight / contentHeight) * imgHeight

        const sliceCanvas = document.createElement('canvas')
        sliceCanvas.width = imgWidth
        sliceCanvas.height = sourceSliceHeight
        const ctx = sliceCanvas.getContext('2d')!
        ctx.drawImage(
          canvas,
          0, sourceY, imgWidth, sourceSliceHeight,
          0, 0, imgWidth, sourceSliceHeight,
        )

        const sliceData = sliceCanvas.toDataURL('image/png')
        const yOffset = isFirstPage ? headerOffset : 20
        pdf.addImage(sliceData, 'PNG', margin, yOffset, contentWidth, sliceHeight)

        sourceY += sourceSliceHeight
        remainingHeight -= sliceHeight
        isFirstPage = false
      }

      const dateStr = formatDate(new Date())
      const fileName = `${projectName}_统计报告_${dateStr}.pdf`
      pdf.save(fileName)
      ElMessage.success('PDF 报告已生成')
    } catch (e) {
      console.error('[PDF] 生成失败:', e)
      ElMessage.error('PDF 生成失败，请重试')
    } finally {
      downloading.value = false
    }
  }

  return { downloading, downloadPDF }
}

function addHeader(pdf: any, projectName: string, pageWidth: number) {
  pdf.setFontSize(14)
  pdf.setTextColor(38, 38, 38)
  pdf.text(`${projectName} - 统计分析报告`, pageWidth / 2, 12, { align: 'center' })
  pdf.setFontSize(9)
  pdf.setTextColor(140, 140, 140)
  pdf.text(`生成时间: ${new Date().toLocaleString('zh-CN')}`, pageWidth / 2, 17, { align: 'center' })
}

function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}
