"use client"

import React from "react"
import { useState, useEffect, useRef } from "react"
import { Mic, Check, MicOff, PlayCircle } from "lucide-react"
import TimerUI, { TimerUIRef } from "@/components/ui/TimerUI"
import { useRouter } from "next/navigation"
import { getSpeechRecognition } from "@/utils/speech-recognition"
import { getSpeechSynthesis } from "@/utils/speech-synthesis"
import { useAtom } from 'jotai'
import { currentRecipeAtom } from "@/lib/atoms"
import { handleVoiceQuery } from "@/lib/handleVoiceQuery"


export default function RecipeStepsPage() {  
  const router = useRouter()
  const [recipe,] = useAtom(currentRecipeAtom)
  
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [isListening, setIsListening] = useState(false)
  const [, setVoiceQuestion] = useState("")
  const [aiAnswer, setAiAnswer] = useState("")
  const [, setShowAiAnswer] = useState(false)
  const [isPausedForSpeech, setIsPausedForSpeech] = useState(false)
  const initialLoadRef = useRef(true)
  // 音声システムが初期化されたかどうかを追跡
  const [isAudioInitialized, setIsAudioInitialized] = useState(false)
  
  // 完了確認ポップアップを表示するかどうか
  const [showCompletionPopup, setShowCompletionPopup] = useState(false)
  // 完了セクションを表示するかどうか
  const [showCompletionSection, setShowCompletionSection] = useState(false)
  
  // TimerUI の参照を保持するための ref
  const timerRef = useRef<TimerUIRef | null>(null)

  // 音声システムを初期化する関数
  const initializeAudioSystem = () => {
    // ダミーの音声出力を生成して初期化
    if (!isAudioInitialized) {
      const synth = getSpeechSynthesis()
      // 空のテキストを読み上げる試み（多くのブラウザでこれが音声APIの初期化として機能する）
      const utterance = new SpeechSynthesisUtterance("")
      window.speechSynthesis.speak(utterance)
      
      // 空の音声コンテキストを作成して初期化
      try {
        const audioCtx = new AudioContext()
        // 一時的に無音を鳴らす
        const oscillator = audioCtx.createOscillator()
        const gainNode = audioCtx.createGain()
        gainNode.gain.value = 0 // 無音
        oscillator.connect(gainNode)
        gainNode.connect(audioCtx.destination)
        oscillator.start()
        oscillator.stop(audioCtx.currentTime + 0.001)
      } catch (e) {
        console.error("Audio initialization failed:", e)
      }
      
      setIsAudioInitialized(true)
    }
  }

  // マイクの状態を定期的にチェックする関数
  const checkMicrophoneStatus = () => {
    const recognition = getSpeechRecognition();
    // マイクが切れていて、音声出力中でもない場合は再開
    if (!recognition.getIsListening() && !isPausedForSpeech) {
      console.log("マイクが切れていたので再開します");
      recognition.startListening(
        (text: string) => {
          setVoiceQuestion(text);
          handleVoiceQuery({
            text,
            step,
            recipeInformation: recipe,
            goToNextStep,
            goToPrevStep,
            setAiAnswer,
            setShowAiAnswer,
            startTimer,
            stopTimer,
          });
        },
        (error: any) => {
          console.error("音声認識エラー:", error);
        }
      );
      setIsListening(true);
    }
  }

  // 調理開始ハンドラー
  const handleStartCooking = () => {
    // 音声システムを初期化
    initializeAudioSystem();
    
    
    // 少し遅延を入れてから最初のステップの指示を読み上げる
    setTimeout(() => {
      if (recipe && recipe.steps && recipe.steps[currentStepIndex]) {
        const synth = getSpeechSynthesis();
        synth.speak(recipe.steps[currentStepIndex].instruction, "ja-JP", true);
      }
    }, 500);
  }

  if (!recipe) return <p>レシピがありません</p>

  // 完了セクションが表示されているときは特別なステップを表示する
  const step = showCompletionSection 
    ? { instruction: "調理が完了しました。お疲れ様でした！", step_number: recipe.steps.length + 1, timer: "" } 
    : recipe.steps[currentStepIndex]

  // 次のステップに進む関数
  const goToNextStep = () => {
    // 最後のステップから次に進むと完了セクションが表示される
    if (currentStepIndex === recipe.steps.length - 1) {
      setShowCompletionSection(true)
      
      // 完了メッセージを読み上げる
      const synth = getSpeechSynthesis()
      synth.speak("調理が完了しました。お疲れ様でした！", "ja-JP", true)
    } else {
      setCurrentStepIndex(i => Math.min(i + 1, recipe.steps.length - 1))
    }
  }
  
  // 前のステップに戻る関数
  const goToPrevStep = () => {
    // 完了セクションから前に戻ると最後のレシピステップに戻る
    if (showCompletionSection) {
      setShowCompletionSection(false)
    } else {
      setCurrentStepIndex(i => Math.max(i - 1, 0))
    }
  }

  // 調理完了確認ポップアップを表示する関数
  const handleCompleteClick = () => {
    setShowCompletionPopup(true)
  }

  // 調理完了を確定し次のページに遷移する関数
  const handleConfirmCompletion = () => {
    router.push("/cooking/submit-photo")
  }
  
  // TimerUI を制御する関数
  const startTimer = () => {
    if (timerRef.current) {
      timerRef.current.start()
    }
  }
  
  const stopTimer = () => {
    if (timerRef.current) {
      timerRef.current.stop()
    }
  }
  
  // 音声合成と音声認識の調整 - システム音声出力中は音声認識を一時停止する
  useEffect(() => {
    const synth = getSpeechSynthesis()
    const recognition = getSpeechRecognition()
    
    if (!recognition.isSupported()) return
    
    // 音声合成開始時のハンドラー
    const handleSpeechStart = () => {
      recognition.pauseListening()
      setIsPausedForSpeech(true)
    }
    
    // 音声合成終了時のハンドラー
    const handleSpeechEnd = () => {
      // 少し遅延を入れて、音声出力が完全に終わってから認識再開
      setTimeout(() => {
        recognition.resumeListening()
        setIsPausedForSpeech(false)
      }, 300)
    }
    
    // イベントリスナー登録
    synth.addEventListener('start', handleSpeechStart)
    synth.addEventListener('end', handleSpeechEnd)
    
    // クリーンアップ
    return () => {
      synth.removeEventListener('start', handleSpeechStart)
      synth.removeEventListener('end', handleSpeechEnd)
    }
  }, [])
  
  // 初期読み上げとステップ変更時の読み上げを管理
  useEffect(() => {
    const synth = getSpeechSynthesis()
    
    if (step && step.instruction) {
      // 最初のステップでは優先度低く、ステップ変更時は優先度高く
      const isPriority = !initialLoadRef.current
      
      // instructionを読み上げる（初期表示または手動でステップ変更時）
      synth.speak(step.instruction, "ja-JP", isPriority)
      
      // 初期ロードフラグを更新
      if (initialLoadRef.current) {
        initialLoadRef.current = false
      }
    }
  }, [currentStepIndex])

  // AIの返答があった場合は優先して読み上げ
  useEffect(() => {
    if (aiAnswer) {
      const synth = getSpeechSynthesis()
      synth.speak(aiAnswer, "ja-JP", true)
    }
  }, [aiAnswer])

  // 音声認識の初期化・クリーンアップ専用 - 継続的な音声認識を実装
  useEffect(() => {
    const recognition = getSpeechRecognition()
    if (!recognition.isSupported()) return
    let isUnmounted = false
    
    const handleResult = (text: string) => {
      setVoiceQuestion(text)
      handleVoiceQuery({
        text,
        step,
        recipeInformation: recipe,
        goToNextStep,
        goToPrevStep,
        setAiAnswer,
        setShowAiAnswer,
        startTimer, // タイマー開始関数を渡す
        stopTimer,  // タイマー停止関数を渡す
      })
      // 継続モードなので再起動は不要
    }
    
    const handleError = (error: any) => {
      console.error("音声認識エラー:", error)
      // エラー発生時のみ再起動（既に起動している場合は startListening 内部でスキップされる）
      if (!isUnmounted && !recognition.getIsListening()) {
        setTimeout(() => recognition.startListening(handleResult, handleError), 1000)
      }
    }
    
    // 音声認識が終了した場合の処理
    const handleEnd = () => {
      // 終了した場合のみ再起動（すでに起動中でない場合のみ）
      if (!isUnmounted && !recognition.getIsListening()) {
        setTimeout(() => recognition.startListening(handleResult, handleError), 500)
      }
    }
    
    // 初回起動
    recognition.startListening(handleResult, handleError)
    
    // onendイベントハンドラの設定（直接アクセスは本来避けるべきだが、現状の実装に合わせる）
    if ((recognition as any).recognition) {
      (recognition as any).recognition.onend = handleEnd
    }
    
    setIsListening(true)
    
    return () => {
      isUnmounted = true
      recognition.stopListening()
      setIsListening(false)
    }
  }, [step, recipe])

  // 定期的にマイクの状態をチェックする
  useEffect(() => {
    // 音声システムが初期化されている場合のみ実行
    if (!isAudioInitialized ) return;
    
    // 定期的にマイク状態をチェック (10秒ごと)
    const intervalId = setInterval(() => {
      checkMicrophoneStatus();
    }, 10000);
    
    // クリーンアップ関数
    return () => {
      clearInterval(intervalId);
    };
  }, [isAudioInitialized, isPausedForSpeech]);

  return (
    <main className="flex min-h-screen flex-col p-4 md:p-8 relative">
      
      

      <header className="flex items-center justify-center sticky top-0 bg-gray-50 p-4 z-10">        
        <h1 className="text-3xl font-semibold text-green-700">{recipe.title}</h1>        
      </header>
      
      <div className="flex-1 flex flex-col items-center max-w-md mx-auto w-full">
          {!showCompletionSection && (
            <div className="mb-4 flex items-center">
              {recipe.steps.map((_, idx) => (
                <React.Fragment key={idx}>
                  {idx > 0 && (
                    <div className="w-6 h-px bg-gray-300 mx-2" />
                  )}
                  <button
                    onClick={() => {
                      setCurrentStepIndex(idx);
                      // ステップ変更時に音声システムを初期化
                      initializeAudioSystem();
                    }}
                    className={`
                      w-7 h-7 flex items-center justify-center rounded-full font-semibold
                      ${idx === currentStepIndex
                        ? "bg-green-600 text-white"
                        : "bg-gray-300 text-gray-700"}
                    `}
                  >
                    {idx + 1}
                  </button>
                </React.Fragment>
              ))}
            </div>
          )}

          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-300 dark:border-gray-800 w-full mb-24">          
            {/* 完了セクション時の特別UI */}
            {showCompletionSection ? (
              <div className="flex flex-col items-center p-4">
                <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6">
                  <Check className="h-12 w-12 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-center mb-4">{step.instruction}</h2>
                <p className="text-gray-600 text-center mb-8">
                  調理が完了しました。写真を撮影して記録に残しましょう。
                </p>
                <div className="flex gap-4 w-full justify-center">
                  <button 
                    onClick={goToPrevStep}
                    className="py-4 px-10 bg-gray-200 text-gray-800 rounded-full hover:bg-gray-300 transition-colors flex items-center"
                  >
                    戻る
                  </button>
                  <button 
                    onClick={handleCompleteClick}
                    className="py-4 px-10 bg-green-600 text-white rounded-full hover:bg-green-700 transition-colors flex items-center"
                  >
                    終了
                  </button>
                </div>
              </div>
            ) : (
              <>
                <section
                  aria-labelledby="instruction-section"
                  className="mb-6 w-full"
                >
                  <div
                    id="instruction-section"
                    className="
                      text-1xl font-bold
                      h-[10rem]            /* 固定高さ */
                      overflow-y-auto    /* 縦スクロール有効 */
                      overflow-x-hidden
                      whitespace-normal break-words
                      p-4                
                      border border-gray-200 dark:border-gray-600
                      rounded-lg
                      shadow-sm
                    "
                  >
                    {step.instruction}
                  </div>
                </section>

                {/* タイマーUI */}
                <section aria-labelledby="timer-section" className="mb-6 w-full h-[10rem]">
                  {step.timer && (
                    <TimerUI 
                      initialTime={step.timer}
                      ref={(el) => {
                        // TimerUIのrefを通じてstart/stopメソッドにアクセス
                        if (el) {
                          timerRef.current = {
                            start: () => el.start && el.start(),
                            stop: () => el.stop && el.stop()
                          };
                        }
                      }}
                    />
                  )}
                </section>
                

                <div className="mt-10 flex items-center justify-between gap-4">
                  <button 
                    onClick={() => {
                      goToPrevStep();
                      // 前へボタンクリック時に音声システムを初期化
                      initializeAudioSystem();
                    }} 
                    disabled={currentStepIndex===0} 
                    className="px-6 py-3 bg-gray-200 rounded-full"
                  >
                    前へ
                  </button>
                  <button
                    type="button"
                    aria-label={isPausedForSpeech ? "マイク停止中" : (isListening ? "録音中（クリックで停止）" : "マイク待機中（クリックで録音開始）")}
                    className={`
                      px-6 py-3 rounded-full flex items-center justify-center transition
                      ${isPausedForSpeech ? "bg-gray-300" : isListening ? "bg-red-600 animate-pulse" : "bg-gray-200"}
                      ${isPausedForSpeech ? "cursor-not-allowed" : "cursor-pointer"}
                    `}
                    disabled={isPausedForSpeech}
                    onClick={() => {
                      // マイクボタンクリック時に音声システムを初期化
                      initializeAudioSystem();
                      
                      if (isPausedForSpeech) return;
                      const recognition = getSpeechRecognition();
                      if (isListening) {
                        recognition.stopListening();
                        setIsListening(false);
                      } else if (!recognition.getIsListening()) {
                        recognition.startListening(
                          (text: string) => {
                            setVoiceQuestion(text);
                            handleVoiceQuery({
                              text,
                              step,
                              recipeInformation: recipe,
                              goToNextStep,
                              goToPrevStep,
                              setAiAnswer,
                              setShowAiAnswer,
                              startTimer,
                              stopTimer,
                            });
                          },
                          (error: any) => {
                            console.error("音声認識エラー:", error);
                          }
                        );
                        setIsListening(true);
                      }
                    }}
                  >
                    {isPausedForSpeech ? (
                      <MicOff className="h-6 w-6 text-gray-400" />
                    ) : isListening ? (
                      <Mic className="h-6 w-6 text-white" />
                    ) : (
                      <Mic className="h-6 w-6 text-green-600" />
                    )}
                  </button>
                  <button 
                    onClick={() => {
                      if (currentStepIndex === recipe.steps.length - 1) {
                        goToNextStep();
                        initializeAudioSystem();
                      } else {
                        goToNextStep();
                        initializeAudioSystem();
                      }
                    }} 
                    className={`px-6 py-3 rounded-full ${currentStepIndex === recipe.steps.length - 1 ? 'bg-green-600 text-white' : 'bg-green-600 text-white'}`}
                  >
                    {currentStepIndex === recipe.steps.length - 1 ? '完了' : '次へ'}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* 画面下部の調理完了ボタンは削除 */}
        </div>
        
        {/* 調理完了確認ポップアップ */}
        {showCompletionPopup && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-white mx-5 dark:bg-gray-800 p-8 rounded-xl max-w-md w-full text-center">
              <h2 className="text-2xl font-bold mb-4">調理完了</h2>
              <p className="mb-6 text-gray-600 dark:text-gray-300">本当に完了しましたか？</p>
              <div className="flex justify-around">
                <button
                  onClick={handleConfirmCompletion}
                  className="py-2 px-4 bg-green-600 text-white rounded-full hover:bg-green-700 transition-colors"
                >
                  はい
                </button>
                <button
                  onClick={() => setShowCompletionPopup(false)}
                  className="py-2 px-4 bg-gray-300 text-gray-800 rounded-full hover:bg-gray-400 transition-colors"
                >
                  いいえ
                </button>
              </div>
            </div>
          </div>
        )}
    </main>
  )
}
