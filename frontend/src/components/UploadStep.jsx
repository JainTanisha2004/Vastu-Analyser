import React, { useState, useRef } from 'react'
import { uploadFile } from '../api/vastuApi'

export default function UploadStep({ onUploadSuccess }) {
  const fileInputRef  = useRef(null)
  const [isDragOver,   setIsDragOver]   = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [isUploading,  setIsUploading]  = useState(false)
  const [uploadDone,   setUploadDone]   = useState(false)
  const [error,        setError]        = useState(null)

  const validateFile = (file) => {
    if (!file) return false
    if (!file.name.toLowerCase().endsWith('.dxf')) {
      setError('Invalid file type. Please upload a .dxf file.')
      return false
    }
    setError(null)
    return true
  }

  const handleFileSelect = (file) => {
    if (validateFile(file)) {
      setSelectedFile(file)
      setUploadDone(false)
      setError(null)
    }
  }

  const openFilePicker = () => {
    if (!fileInputRef.current) return
    // Clearing the value lets selecting the same file emit a fresh change event.
    fileInputRef.current.value = ''
    fileInputRef.current.click()
  }

  const handlePickerKeyDown = (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    openFilePicker()
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragOver(false)
    handleFileSelect(e.dataTransfer.files[0])
  }

  const handleUpload = async (e) => {
    e.stopPropagation()
    if (!selectedFile || isUploading) return
    setIsUploading(true)
    setError(null)
    try {
      const data = await uploadFile(selectedFile)
      setUploadDone(true)
      onUploadSuccess(data)
    } catch (err) {
      setError(err.message || 'Upload failed. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const zoneBg      = uploadDone  ? 'rgba(240, 253, 244, 0.7)'
                    : isDragOver  ? 'rgba(255, 247, 237, 0.7)'
                    : selectedFile ? 'rgba(255, 251, 235, 0.5)'
                    : 'rgba(255, 255, 255, 0.3)'

  const canUpload = !!selectedFile && !isUploading && !uploadDone

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }} className="animate-fadeSlideIn">

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
        onDragLeave={() => setIsDragOver(false)}
        onClick={openFilePicker}
        onKeyDown={handlePickerKeyDown}
        role="button"
        tabIndex={0}
        aria-label="Choose DXF floor plan"
        style={{
          flex: 1,
          border: '2px dashed #D1D5DB',
          borderRadius: '16px',
          backgroundColor: zoneBg,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '20px',
          cursor: 'pointer',
          transition: 'border-color 0.25s ease, background-color 0.25s ease, transform 0.2s ease',
          transform: isDragOver ? 'scale(1.004)' : 'scale(1)',
          minHeight: '320px',
        }}
      >
        {uploadDone ? (
          <div className="animate-float" style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12l5 5L20 7" />
            </svg>
          </div>
        ) : (
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: isDragOver ? '#FFF7ED' : '#F5F5F4', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color 0.25s ease' }}>
            <svg width="36" height="36" viewBox="0 0 48 48" fill="none" style={{ color: isDragOver ? '#F97316' : '#D6D3D1', transition: 'color 0.25s ease' }}>
              <path d="M36 30v4a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M30 18l-6-6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M24 12v16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
        )}

        {selectedFile ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '15px', fontWeight: 700, color: '#1C1917', letterSpacing: '-0.01em' }}>{selectedFile.name}</p>
            <p style={{ fontSize: '12px', color: '#A8A29E', marginTop: '6px', fontWeight: 500 }}>{formatSize(selectedFile.size)}</p>
            {uploadDone && <p style={{ fontSize: '14px', color: '#16A34A', fontWeight: 700, marginTop: '10px' }}>File uploaded successfully</p>}
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '15px', fontWeight: 500, color: '#57534E' }}>
              <span style={{ color: '#EA580C', fontWeight: 700 }}>Upload</span> Your Floor Plan or drop a file
            </p>
            <p style={{ fontSize: '11px', color: '#C7C3C0', marginTop: '8px', fontWeight: 500, letterSpacing: '0.04em' }}>
              Supported formats: DXF &nbsp;·&nbsp; Max size: 70 MB
            </p>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".dxf"
        aria-label="DXF floor plan file"
        onChange={(e) => handleFileSelect(e.target.files[0])}
        style={{ display: 'none' }}
      />

      {error && (
        <div role="alert" className="animate-fadeSlideIn" style={{ marginTop: '12px', padding: '10px 16px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '12px', color: '#DC2626', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>WARNING</span> {error}
        </div>
      )}

      {/* Upload button - always visible, absolutely positioned */}
      <button
        onClick={handleUpload}
        disabled={!canUpload}
        style={{
          position: 'absolute',
          bottom: '20px',
          right: '24px',
          minWidth: '100px',
          height: '44px',
          padding: '12px 28px',
          borderRadius: '10px',
          border: 'none',
          fontSize: '15px',
          fontWeight: 700,
          cursor: canUpload ? 'pointer' : 'not-allowed',
          opacity: canUpload ? 1 : 0.5,
          transition: 'all 0.2s ease',
          backgroundColor: uploadDone ? '#DCFCE7' : '#EAB308',
          color: uploadDone ? '#16A34A' : '#FFFFFF',
          boxShadow: canUpload ? '0 4px 14px rgba(234,179,8,0.4)' : 'none',
          zIndex: 5,
        }}
        onMouseEnter={(e) => { if (canUpload) e.target.style.transform = 'translateY(-1px)' }}
        onMouseLeave={(e) => { if (canUpload) e.target.style.transform = 'translateY(0)' }}
      >
        {isUploading ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg className="animate-spin-slow" width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" style={{ opacity: 0.25 }} />
              <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" style={{ opacity: 0.75 }} />
            </svg>
            Uploading...
          </span>
        ) : uploadDone ? 'Uploaded' : 'Upload & Next'}
      </button>
    </div>
  )
}
