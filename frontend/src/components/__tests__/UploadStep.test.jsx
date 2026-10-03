import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { uploadFile } from '../../api/vastuApi'
import UploadStep from '../UploadStep'

vi.mock('../../api/vastuApi', () => ({
  uploadFile: vi.fn(),
}))

describe('UploadStep', () => {
  beforeEach(() => {
    uploadFile.mockReset()
  })

  it('selects and uploads a DXF through the labelled file input', async () => {
    const user = userEvent.setup()
    const onUploadSuccess = vi.fn()
    const response = { file_id: 'file-123', rooms: [] }
    uploadFile.mockResolvedValue(response)
    render(<UploadStep onUploadSuccess={onUploadSuccess} />)

    const file = new File(['synthetic dxf'], 'student-plan.dxf', { type: 'application/dxf' })
    await user.upload(screen.getByLabelText('DXF floor plan file'), file)
    expect(screen.getByText('student-plan.dxf')).toBeInTheDocument()

    const uploadButton = screen.getByRole('button', { name: 'Upload & Next' })
    expect(uploadButton).toBeEnabled()
    await user.click(uploadButton)

    expect(uploadFile).toHaveBeenCalledWith(file)
    expect(onUploadSuccess).toHaveBeenCalledWith(response)
    expect(screen.getByText('File uploaded successfully')).toBeInTheDocument()
  })

  it('allows the same file to be selected again after a completed upload', async () => {
    const user = userEvent.setup()
    uploadFile.mockResolvedValue({ file_id: 'file-123', rooms: [] })
    render(<UploadStep onUploadSuccess={vi.fn()} />)

    const input = screen.getByLabelText('DXF floor plan file')
    const file = new File(['synthetic dxf'], 'same-plan.dxf', { type: 'application/dxf' })
    await user.upload(input, file)
    await user.click(screen.getByRole('button', { name: 'Upload & Next' }))
    expect(screen.getByText('File uploaded successfully')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Choose DXF floor plan' }))
    await user.upload(input, file)

    expect(screen.queryByText('File uploaded successfully')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Upload & Next' })).toBeEnabled()
  })

  it('opens the picker from Enter and Space keyboard activation', async () => {
    const user = userEvent.setup()
    render(<UploadStep onUploadSuccess={vi.fn()} />)
    const picker = screen.getByRole('button', { name: 'Choose DXF floor plan' })
    const input = screen.getByLabelText('DXF floor plan file')
    const clickSpy = vi.spyOn(input, 'click')

    picker.focus()
    await user.keyboard('{Enter}')
    await user.keyboard(' ')
    expect(clickSpy).toHaveBeenCalledTimes(2)
  })

  it('shows a clear unsupported type message', async () => {
    const user = userEvent.setup({ applyAccept: false })
    render(<UploadStep onUploadSuccess={vi.fn()} />)
    await user.upload(
      screen.getByLabelText('DXF floor plan file'),
      new File(['pixels'], 'plan.png', { type: 'image/png' }),
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Invalid file type. Please upload a .dxf file.',
    )
    expect(screen.getByRole('button', { name: 'Upload & Next' })).toBeDisabled()
  })

  it('prevents a second upload while the first submission is pending', async () => {
    const user = userEvent.setup()
    let finishUpload
    uploadFile.mockImplementation(() => new Promise((resolve) => { finishUpload = resolve }))
    render(<UploadStep onUploadSuccess={vi.fn()} />)
    await user.upload(
      screen.getByLabelText('DXF floor plan file'),
      new File(['synthetic dxf'], 'pending.dxf', { type: 'application/dxf' }),
    )

    const uploadButton = screen.getByRole('button', { name: 'Upload & Next' })
    await user.dblClick(uploadButton)
    expect(uploadFile).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Uploading...' })).toBeDisabled()
    finishUpload({ file_id: 'file-123', rooms: [] })
  })
})
