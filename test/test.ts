import { HttpieResponse } from 'httpie'
import requests from '../lib'

requests('https://google.com/humans.txt')
requests({
  url: 'https://google.com/humans.txt',
  out: (res:HttpieResponse<string>, files, metalsmith) => {
    res.data
    Object.keys(files)
    metalsmith.metadata()
  }
})