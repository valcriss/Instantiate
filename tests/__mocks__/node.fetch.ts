const fetch = jest.fn().mockResolvedValue({
  json: jest.fn().mockResolvedValue({}),
  text: jest.fn().mockResolvedValue('')
})

export default fetch
