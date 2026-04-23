import { cn, getFileUrl } from '@/lib/utils'

describe('utils', () => {
  describe('cn', () => {
    it('should merge tailwind classes', () => {
      expect(cn('p-4', 'bg-red-500')).toBe('p-4 bg-red-500')
      expect(cn('p-4', 'p-2')).toBe('p-2')
    })
  })

  describe('getFileUrl', () => {
    const originalEnv = process.env.NEXT_PUBLIC_API_BASE_URL

    beforeEach(() => {
      process.env.NEXT_PUBLIC_API_BASE_URL = 'http://test-api.com'
    })

    afterAll(() => {
      process.env.NEXT_PUBLIC_API_BASE_URL = originalEnv
    })

    it('should return undefined for null or empty path', () => {
      expect(getFileUrl(null)).toBeUndefined()
      expect(getFileUrl('')).toBeUndefined()
    })

    it('should return the path if it starts with http, blob or data', () => {
      expect(getFileUrl('http://example.com/img.png')).toBe('http://example.com/img.png')
      expect(getFileUrl('blob:1234')).toBe('blob:1234')
      expect(getFileUrl('data:image/png;base64,123')).toBe('data:image/png;base64,123')
    })

    it('should prefix relative paths with base URL', () => {
      expect(getFileUrl('uploads/avatar.png')).toBe('http://test-api.com/uploads/avatar.png')
      expect(getFileUrl('/uploads/avatar.png')).toBe('http://test-api.com/uploads/avatar.png')
    })
  })
})
