import Head from 'next/head'
import { useState, useEffect, useRef } from 'react'
import { InteractiveSegment, Point, Mask, Data }
  from '../components/interactive_segment'

const uiBasiclClassName = 'transition-all my-2 rounded-xl px-4 py-2 cursor-pointer outline outline-gray-200 ';
const uiActiveClassName = 'bg-blue-500 text-white';
const uiInactiveClassName = 'bg-white text-gray-400';

function Popup(text: string, timeout: number = 1000) {
  const popup = document.createElement('div')
  popup.className = 'fixed top-1/2 left-1/2 transform -translate-x-1/2 z-50 bg-white text-gray-500 rounded-xl px-4 py-2'
  popup.innerHTML = text
  document.body.appendChild(popup)
  setTimeout(() => {
    popup.remove()
  }, timeout)
}


function Workspace() {
  const [data, setData] = useState<Data | null>(null)
  const [mode, setMode] = useState<'click' | 'box' | 'everything'>('click')
  const [points, setPoints] = useState<Point[]>([])
  const [masks, setMasks] = useState<Mask[]>([])
  const [prompt, setPrompt] = useState<string>('')
  const [processing, setProcessing] = useState<boolean>(false)
  const [ready, setBoxReady] = useState<boolean>(false)
  const controller = useRef<AbortController | null>()

  useEffect(() => {
    if (!data) return
    if (mode === 'click' && points.length > 0) {
      const fromData = new FormData()
      fromData.append('file', new File([data.file], 'image.png'))
      const points_list = points.map((p) => {
        return {
          x: Math.round(p.x),
          y: Math.round(p.y)
        }
      })
      const points_labels = points.map((p) => p.label)
      fromData.append('points', JSON.stringify(
        { points: points_list, points_labels }
      ))
      controller.current?.abort()
      controller.current = new AbortController()
      setProcessing(true)
      fetch('/api/point', {
        method: 'POST',
        body: fromData,
        signal: controller.current?.signal,
      }).then((res) => {
        return res.json()
      }).then((res) => {
        if (res.code == 0) {
          const maskData = res.data.map((mask: any) => {
            return mask
          })
          setMasks(maskData)
        }
      }).finally(() => {
        setProcessing(false)
      })
    }
    if (mode === 'box') {
      if (!ready) return
      if (points.length !== 2) return
      const fromData = new FormData()
      fromData.append('file', new File([data.file], 'image.png'))
      fromData.append('box', JSON.stringify(
        {
          x1: Math.round(points[0].x),
          y1: Math.round(points[0].y),
          x2: Math.round(points[1].x),
          y2: Math.round(points[1].y),
        }
      ))
      controller.current?.abort()
      controller.current = new AbortController()
      setProcessing(true)
      fetch('/api/box', {
        method: 'POST',
        body: fromData,
        signal: controller.current?.signal
      }).then((res) => {
        return res.json()
      }).then((res) => {
        if (res.code == 0) {
          setPoints([])
          const maskData = res.data.map((mask: any) => {
            return mask
          })
          setMasks(maskData)
        }
      }).finally(() => {
        setProcessing(false)
        setBoxReady(false)
      })
    }
  }, [data, mode, points, ready])

  useEffect(() => {
    setPoints([])
    setMasks([])
    setProcessing(false)
    switch (mode) {
      case 'click':
        break
      case 'box':
        break
      case 'everything':
        break
    }
  }, [mode])

  const handleTextPrompt = () => {
    if (prompt === '' || !data) return
    const fromData = new FormData()
    fromData.append('file', new File([data.file], 'image.png'))
    fromData.append('prompt',
      JSON.stringify({ text: prompt }))
    controller.current?.abort()
    controller.current = new AbortController()
    setProcessing(true)
    fetch('/api/clip', {
      method: 'POST',
      body: fromData,
      signal: controller.current?.signal
    }).then((res) => {
      setProcessing(false)
      return res.json()
    }).then((res) => {
      if (res.code == 0) {
        const maskData = res.data.map((mask: any) => {
          return mask
        })
        setMasks(maskData)
      }
    })
  }

  const handleEverything = () => {
    setMode('everything')
    if (!data) return
    const fromData = new FormData()
    fromData.append('file', new File([data.file], 'image.png'))
    controller.current?.abort()
    controller.current = new AbortController()
    setProcessing(true)
    fetch('/api/everything', {
      method: 'POST',
      body: fromData,
      signal: controller.current?.signal
    }).then((res) => {
      setProcessing(false)
      return res.json()
    }).then((res) => {
      if (res.code == 0) {
        const maskData = res.data.map((mask: any) => {
          return mask
        })
        setMasks(maskData)
      }
    })
  }


  return (
    <div className="flex items-stretch justify-center flex-1 stage min-h-fit">
      <section className="flex-col hidden min-w-[225px] w-1/5 py-5 overflow-y-auto md:flex lg:w-72">
        <div className='shadow-[0px_0px_5px_5px_#00000024] rounded-xl mx-2'>
          <div className='p-4 pt-5'>
            <p className='text-lg font-semibold'>Tools</p>
            <div>
              <div className={uiBasiclClassName}>
                <p>Interactive Mode</p>
                <div>
                  <button
                    className={
                      uiBasiclClassName +
                      (mode === 'click' ? uiActiveClassName : uiInactiveClassName)
                    }
                    onClick={() => { setMode('click') }} >
                    Click
                  </button>
                </div>
                <div>
                  <button
                    className={
                      uiBasiclClassName +
                      (mode === 'box' ? uiActiveClassName : uiInactiveClassName)
                    }
                    onClick={() => { setMode('box') }} >
                    Box
                  </button>
                </div>
                <div>
                  <button
                    className={
                      uiBasiclClassName +
                      (mode === 'everything' ? uiActiveClassName : uiInactiveClassName)
                    }
                    onClick={handleEverything} >
                    Everything
                  </button>
                </div>
              </div>
              <div className={uiBasiclClassName}>
                <textarea className='w-full h-20 outline outline-gray-200 p-1'
                  onChange={(e) => {
                    setPrompt(e.target.value)
                  }}
                  value={prompt} />
                <button
                  className='my-2 rounded-xl px-4 py-2 cursor-pointer outline outline-gray-200 bg-white hover:bg-blue-500 hover:text-white'
                  onClick={handleTextPrompt}
                >
                  CLIP Send
                </button>
              </div>
              {masks.length > 0 && (
                <div className={uiBasiclClassName}>
                  <p>Segment</p>
                  <button
                    className={uiBasiclClassName}
                    onClick={(e) => {
                      var datastr = "data:text/json;charset=utf-8," + encodeURIComponent(
                        JSON.stringify({
                          masks: masks,
                          points: points,
                        }));
                      var downloadAnchorNode = document.createElement('a');
                      downloadAnchorNode.setAttribute("href", datastr);
                      downloadAnchorNode.setAttribute("download", "masks.json");
                      document.body.appendChild(downloadAnchorNode); // required for firefox
                      downloadAnchorNode.click();
                      downloadAnchorNode.remove();
                    }}
                  >
                    Download Result
                  </button>
                  <button
                    className={uiBasiclClassName}
                    onClick={(e) => {
                      navigator.clipboard.writeText(JSON.stringify({
                        masks: masks,
                        points: points,
                      }))
                      Popup('Copied', 1000)
                    }}
                  >
                    Copy Result
                  </button>
                </div>
              )}
            </div>
            <div className={uiBasiclClassName}>
              <p>Interactive Setting</p>
              <button
                className='false my-2 rounded-xl px-4 py-2 cursor-pointer outline outline-gray-200'
                onClick={() => {
                  setPoints([])
                  setMasks([])
                  setBoxReady(false)
                  setProcessing(false)
                }} >
                Clean Segment
              </button>
              <button
                className='false my-2 rounded-xl px-4 py-2 cursor-pointer outline outline-gray-200'
                onClick={() => {
                  setData(null)
                  setPoints([])
                  setMasks([])
                  setMode('click')
                }} >
                Clean All
              </button>
            </div>
          </div>
        </div>
      </section >
      {
        data ?
          (<div className="flex flex-1 flex-col max-w-[1080px] m-auto my-2 md:px-12 md:py-9" >
            <InteractiveSegment
              data={data} mode={mode} processing={processing}
              points={points} setPoints={setPoints} masks={masks}
              ready={ready} setBoxReady={setBoxReady} />
            {processing && (
              <div className=" left-0 w-full flex items-center bg-black bg-opacity-50">
                <div className="flex flex-col items-center justify-center w-full h-full">
                  <div className="text-white text-2xl">Processing</div>
                  <div className='flex flex-row justify-center'>
                    <div className='w-2 h-2 bg-white rounded-full animate-bounce mx-1'></div>
                    <div className='w-2 h-2 bg-white rounded-full animate-bounce mx-1'></div>
                    <div className='w-2 h-2 bg-white rounded-full animate-bounce mx-1'></div>
                  </div>
                  <div className="text-white text-sm">Please wait a moment</div>
                </div>
              </div>
            )
            }
          </div >) :
          (<div
            className="flex flex-1 flex-col max-w-[1080px] m-auto my-2 md:px-12 md:py-9"
          >
            <div
              className={
                "flex flex-col items-center justify-center w-full h-96 border-2 border-dashed border-gray-400 rounded-lg " +
                "hover:border-blue-500 hover:bg-blue-50 hover:text-blue-500" +
                "focus-within:border-blue-500 focus-within:bg-blue-50 focus-within:text-blue-500"
              }
              onDragOver={(e) => {
                e.preventDefault()
              }}
              onDrop={(e) => {
                e.preventDefault()
                const file = e.dataTransfer.files[0]
                if (file) {
                  const img = new Image()
                  img.src = URL.createObjectURL(file)
                  img.onload = () => {
                    setData({
                      width: img.width,
                      height: img.height,
                      file,
                      img,
                    })
                  }
                }
              }}
            >
              <p className="text-sm text-gray-400 md:visible sm:invisible">Drag and drop your image here</p>
              <p className="text-sm text-gray-400">or</p>
              <button
                className="transition-all false max-h-[40px] my-2 rounded-xl px-4 py-2 cursor-pointer outline outline-gray-200 false false"
                onClick={() => {
                  const input = document.createElement('input')
                  input.type = 'file'
                  input.accept = 'image/*'
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0]
                    if (file) {
                      const img = new Image()
                      img.src = URL.createObjectURL(file)
                      img.onload = () => {
                        setData({
                          width: img.width,
                          height: img.height,
                          file,
                          img,
                        })
                      }
                    }
                  }
                  input.click()
                }}
              >
                Upload a file
              </button>
            </div>
          </div>)
      }
      <section className="hidden w-full absolute bottom-0 max-md:inline-block">
        <div className='transition-all m-2 rounded-xl px-4 py-2 cursor-pointer outline outline-gray-200'>
          <p>Interactive Mode</p>
          <button
            className={
              'transition-all m-1 rounded-xl px-4 py-2 cursor-pointer outline outline-gray-200 ' +
              (mode === 'click' ? uiActiveClassName : uiInactiveClassName)
            }
            onClick={() => { setMode('click') }} >
            Click
          </button>
          <button
            className={
              'transition-all m-1 rounded-xl px-4 py-2 cursor-pointer outline outline-gray-200 ' +
              (mode === 'everything' ? uiActiveClassName : uiInactiveClassName)
            }
            onClick={handleEverything} >
            Everything
          </button>
        </div>

        <div className='transition-all m-2 rounded-xl px-4 py-2 cursor-pointer outline outline-gray-200'>
          <textarea className='w-full h-20 outline outline-gray-200 p-1'
            onChange={(e) => {
              setPrompt(e.target.value)
            }}
            value={prompt} />
          <button
            className='m-1 rounded-xl px-4 py-2 cursor-pointer outline outline-gray-200 bg-white hover:bg-blue-500 hover:text-white'
            onClick={handleTextPrompt}
          >CLIP Send</button>
        </div>
        {masks.length > 0 && (
          <div className='transition-all m-2 rounded-xl px-4 py-2 cursor-pointer outline outline-gray-200'>
            <p>Segment</p>
            <button
              className='transition-all m-1 rounded-xl px-4 py-2 cursor-pointer outline outline-gray-200'
              onClick={(e) => {
                var datastr = "data:text/json;charset=utf-8," + encodeURIComponent(
                  JSON.stringify({
                    masks: masks,
                    points: points,
                  }));
                var downloadAnchorNode = document.createElement('a');
                downloadAnchorNode.setAttribute("href", datastr);
                downloadAnchorNode.setAttribute("download", "masks.json");
                document.body.appendChild(downloadAnchorNode); // required for firefox
                downloadAnchorNode.click();
                downloadAnchorNode.remove();
              }}
            >Download Result</button>
            <button
              className='transition-all overflow m-1 rounded-xl px-4 py-2 cursor-pointer outline outline-gray-200'
              onClick={(e) => {
                navigator.clipboard.writeText(JSON.stringify({
                  masks: masks,
                  points: points,
                }))
                Popup('Copied', 1000)
              }}
            >
              Copy Result
            </button>
          </div>
        )}
        <div className='transition-all overflow m-2 rounded-xl px-4 py-2 cursor-pointer outline outline-gray-200'>
          <button
            className='false m-1 rounded-xl px-4 py-2 cursor-pointer outline outline-gray-200'
            onClick={() => {
              setPoints([])
              setMasks([])
              setBoxReady(false)
              setProcessing(false)
            }} >
            Clean Segment
          </button>
          <button
            className='false m-1 rounded-xl px-4 py-2 cursor-pointer outline outline-gray-200'
            onClick={() => {
              setData(null)
              setPoints([])
              setMasks([])
              setMode('click')
            }} >
            Clean All
          </button>
        </div>
      </section>
    </div >
  )
}

export default function Home() {

  return (
    <>
      <Head>
        <title>Image Segment</title>
        <meta name="description" content="Image Segment" />
      </Head>
      <main className="flex-col min-h-full">
        <div className="flex items-center border-b-[1px] pt-3 pb-3">
          <h1 className="m-2 text-xl font-bold leading-tight md:mx-6 lg:text-2xl">Image Segment</h1>
          <div className='hidden ml-auto md:flex [&>*]:flex [&>*]:items-center min-h-full'>
            <p className="mr-10 font-medium text-base text-gray-600">Inject Human Intelligence into Data</p>
          </div>
        </div>
        <Workspace />
      </main>
    </>
  )
}
