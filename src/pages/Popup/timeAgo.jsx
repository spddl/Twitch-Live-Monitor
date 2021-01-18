const zeroPad2 = num => num < 10 ? '0' + num : num
export default function timeAgo (timeStamp, now) {
  const StartedAt = new Date(timeStamp).getTime()
  const difference = now - StartedAt
  const date = new Date(difference)

  const mm = zeroPad2(date.getMinutes())
  const ss = zeroPad2(date.getSeconds())

  if (difference >= 8.64e7) { // 1 Tag
    const HH = zeroPad2(date.getHours())
    const DD = date.getDate()
    return `${DD}:${HH}:${mm}:${ss}`
  } else if (difference >= 3.6e6) { // 1 Stunde
    const HH = zeroPad2(date.getHours())
    return `${HH}:${mm}:${ss}`
  } else {
    return `${mm}:${ss}`
  }
}
