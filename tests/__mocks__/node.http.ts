const http = {
  request: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    end: jest.fn()
  }))
}

export default http
