import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import ImageGallery from '@/components/public/ImageGallery'

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt }: any) => React.createElement('img', { src, alt }),
}))

jest.mock('@heroicons/react/24/outline', () => ({
  XMarkIcon: () => React.createElement('span', { 'data-testid': 'close' }),
  ChevronLeftIcon: () => React.createElement('span', { 'data-testid': 'prev' }),
  ChevronRightIcon: () => React.createElement('span', { 'data-testid': 'next' }),
  PhotoIcon: () => React.createElement('span', { 'data-testid': 'photo-icon' }),
}))

const IMAGES = [
  'https://example.com/photo1.jpg',
  'https://example.com/photo2.jpg',
  'https://example.com/photo3.jpg',
]

describe('ImageGallery', () => {
  // 1. Renders the gallery grid when images are provided
  it('renders gallery images when images are provided', () => {
    render(<ImageGallery images={IMAGES} roomName="Test Room" />)
    // The main image should be rendered (among multiple img elements)
    const imgs = screen.getAllByRole('img')
    const srcs = imgs.map((img) => img.getAttribute('src'))
    expect(srcs).toContain(IMAGES[0])
  })

  it('renders a placeholder when no images are provided', () => {
    render(<ImageGallery images={[]} roomName="Empty Room" />)
    expect(screen.getByText('Empty Room')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  // 2. Opens lightbox when a photo is clicked
  it('opens the lightbox when the main image button is clicked', () => {
    render(<ImageGallery images={IMAGES} roomName="Test Room" />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[0])

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  // 3. In lightbox: shows caption when descriptions[currentUrl] exists
  it('shows caption in lightbox when descriptions entry exists for the active image', () => {
    const descriptions = {
      [IMAGES[0]]: 'Beautiful sunrise view',
    }
    render(<ImageGallery images={IMAGES} roomName="Test Room" descriptions={descriptions} />)

    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[0])

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Beautiful sunrise view')).toBeInTheDocument()
  })

  // 4. In lightbox: no caption element when descriptions is not provided
  it('shows no caption in lightbox when descriptions prop is not provided', () => {
    render(<ImageGallery images={IMAGES} roomName="Test Room" />)

    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[0])

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    // There should be no <p> caption element — only the counter span
    const dialog = screen.getByRole('dialog')
    const paragraphs = dialog.querySelectorAll('p')
    expect(paragraphs).toHaveLength(0)
  })

  // 5. In lightbox: no caption when the current image URL has no entry in descriptions
  it('shows no caption when current image has no descriptions entry', () => {
    const descriptions = {
      [IMAGES[1]]: 'Only second image has a caption',
    }
    render(<ImageGallery images={IMAGES} roomName="Test Room" descriptions={descriptions} />)

    // Open lightbox on first image (index 0), which has no caption
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[0])

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    const dialog = screen.getByRole('dialog')
    const paragraphs = dialog.querySelectorAll('p')
    expect(paragraphs).toHaveLength(0)
  })

  // 6. Counter always shows e.g. "1 / 3"
  it('shows the correct counter in the lightbox', () => {
    render(<ImageGallery images={IMAGES} roomName="Test Room" />)

    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[0])

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
  })

  // 7. Caption updates when navigating to next/prev image
  it('updates caption when navigating to the next image', () => {
    const descriptions = {
      [IMAGES[0]]: 'Caption for first image',
      [IMAGES[1]]: 'Caption for second image',
    }
    render(<ImageGallery images={IMAGES} roomName="Test Room" descriptions={descriptions} />)

    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[0])

    // Verify first caption is shown
    expect(screen.getByText('Caption for first image')).toBeInTheDocument()
    expect(screen.queryByText('Caption for second image')).not.toBeInTheDocument()

    // Click next
    fireEvent.click(screen.getByLabelText('Next photo'))

    // Verify caption updated to second image
    expect(screen.queryByText('Caption for first image')).not.toBeInTheDocument()
    expect(screen.getByText('Caption for second image')).toBeInTheDocument()
    expect(screen.getByText('2 / 3')).toBeInTheDocument()
  })

  it('updates caption when navigating to the previous image', () => {
    const descriptions = {
      [IMAGES[0]]: 'Caption for first image',
      [IMAGES[1]]: 'Caption for second image',
    }
    render(<ImageGallery images={IMAGES} roomName="Test Room" descriptions={descriptions} />)

    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[0])

    // Navigate forward to second image
    fireEvent.click(screen.getByLabelText('Next photo'))
    expect(screen.getByText('Caption for second image')).toBeInTheDocument()
    expect(screen.getByText('2 / 3')).toBeInTheDocument()

    // Navigate back to first image
    fireEvent.click(screen.getByLabelText('Previous photo'))
    expect(screen.getByText('Caption for first image')).toBeInTheDocument()
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
  })

  it('closes the lightbox when the close button is clicked', () => {
    render(<ImageGallery images={IMAGES} roomName="Test Room" />)

    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[0])

    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Close photo gallery'))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
