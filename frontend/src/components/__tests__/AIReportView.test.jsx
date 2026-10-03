import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import AIReportView from '../AIReportView'

describe('AIReportView Component', () => {
  const sampleReport = {
    report_id: 'test-report-uuid',
    compliance_percent: 68.5,
    overall_rating: 'Good',
    executive_summary: 'Your home has strong positive energies in the North and East.',
    overall_energy_assessment: 'Cosmic prana moves harmoniously across living sectors.',
    positive_highlights: ['Kitchen in SE is ideal', 'Mandir in NE brings tranquility'],
    priority_actions: [
      {
        priority: 1,
        room_type: 'Toilet',
        direction: 'NE',
        impact: 'Critical',
        action: 'Place raw rock salt bowl in toilet and keep door closed.',
      },
    ],
    room_analyses: [
      {
        room_id: 'room-1',
        room_type: 'Kitchen',
        direction: 'SE',
        ideal_zone: 'SE',
        score: 12.0,
        max_score: 12.0,
        status: 'auspicious',
        narrative: 'Kitchen in SE is governed by Agni Dev and promotes vitality.',
        traditional_significance: 'Traditional hearth fire location.',
        remedies: [],
      },
      {
        room_id: 'room-2',
        room_type: 'Toilet',
        direction: 'NE',
        ideal_zone: 'NW',
        score: -10.0,
        max_score: 10.0,
        status: 'unfavourable',
        narrative: 'Toilet in NE disrupts the divine Ishanya portal.',
        traditional_significance: 'Sacred ether quadrant.',
        remedies: [
          {
            type: 'object',
            severity: 'immediate',
            title: 'Rock Salt Absorber',
            description: 'Place raw marine salt bowl.',
          },
        ],
      },
    ],
    optimization_narrative: 'Swapping Kitchen and Master Bedroom raises score by 15%.',
  }

  it('renders executive summary, highlights, and room cards', () => {
    render(
      <AIReportView
        reportData={sampleReport}
        analysisData={{ compliance_percent: 68.5, rows: [] }}
        isLoading={false}
        error={null}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByText(/AI-Powered Vastu Evaluation Report/i)).toBeInTheDocument()
    expect(screen.getByText(/Your home has strong positive energies/i)).toBeInTheDocument()
    expect(screen.getByText(/Kitchen in SE is ideal/i)).toBeInTheDocument()
    expect(screen.getByText(/Kitchen in SE is governed by Agni Dev/i)).toBeInTheDocument()
    expect(screen.getByText(/Toilet in NE disrupts the divine Ishanya portal/i)).toBeInTheDocument()
  })

  it('filters room list by status when clicking filter pills', () => {
    render(
      <AIReportView
        reportData={sampleReport}
        analysisData={{ compliance_percent: 68.5, rows: [] }}
        isLoading={false}
        error={null}
        onClose={vi.fn()}
      />,
    )

    // Click 'Needs Remedy'
    const needsRemedyBtn = screen.getByRole('button', { name: /Needs Remedy/i })
    fireEvent.click(needsRemedyBtn)

    expect(screen.getByText(/Toilet in NE disrupts the divine Ishanya portal/i)).toBeInTheDocument()
    expect(screen.queryByText(/Kitchen in SE is governed by Agni Dev/i)).not.toBeInTheDocument()

    // Click 'Auspicious'
    const auspiciousBtn = screen.getByRole('button', { name: /Auspicious/i })
    fireEvent.click(auspiciousBtn)

    expect(screen.getByText(/Kitchen in SE is governed by Agni Dev/i)).toBeInTheDocument()
    expect(screen.queryByText(/Toilet in NE disrupts the divine Ishanya portal/i)).not.toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn()
    render(
      <AIReportView
        reportData={sampleReport}
        analysisData={{ compliance_percent: 68.5, rows: [] }}
        isLoading={false}
        error={null}
        onClose={handleClose}
      />,
    )

    const closeButtons = screen.getAllByTitle(/close/i)
    fireEvent.click(closeButtons[0])
    expect(handleClose).toHaveBeenCalled()
  })
})
