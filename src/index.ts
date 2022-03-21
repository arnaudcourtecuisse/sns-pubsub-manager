import EventEmitter from 'events'
import SnsPubSub from './sns-pub-sub'

/* eslint-disable class-methods-use-this */

interface LambdaSnsRecord {
  Sns: {
    Message: string
  }
}

interface LambdaSnsEvent {
  Records: [LambdaSnsRecord, ...LambdaSnsRecord[]]
}

interface HttpSnsNotification {
  type: 'Notification'
  Message: string
}

type Consumer<P> = (message: P) => void | Promise<void>

export default class PubSubManager<P> {
  private pubsub?: SnsPubSub<P>
  private emitter: EventEmitter

  constructor(options: { topicArn: string } | { topicName: string }) {
    this.emitter = new EventEmitter()
    if ('topicArn' in options) {
      this.pubsub = new SnsPubSub<P>(options.topicArn)
      return
    }

    SnsPubSub.client
      .createTopic({ Name: options.topicName })
      .promise()
      .then((response) => {
        // @ts-expect-error TopicArn can be undefined but it should not happen
        const topicArn: string = response.TopicArn
        if (!response.TopicArn) {
          throw new Error('AWS did not return ARN for created SNS topic')
        }
        this.pubsub = new SnsPubSub<P>(topicArn)
        this.emitter.emit('ready')
      })
      .catch((err) => this.emitter.emit('error', err))
    return
  }

  getSnsConsumer(consumer: Consumer<P>) {
    return async (event: LambdaSnsEvent | HttpSnsNotification) => {
      if ('Records' in event) {
        const raw = event.Records[0].Sns.Message
        return consumer(JSON.parse(raw))
      }
      const raw = event.Message
      return consumer(JSON.parse(raw))
    }
  }

  waitPubsubInit() {
    return new Promise<void>((resolve, reject) => {
      this.emitter.once('ready', () => {
        this.emitter.removeAllListeners('error')
        resolve()
      })
      this.emitter.once('error', () => {
        this.emitter.removeAllListeners('ready')
        reject()
      })
    })
  }

  // PubSub wrapping
  async subscribe(endpoint: string) {
    if (!this.pubsub) {
      await this.waitPubsubInit()
    }
    await (this.pubsub as SnsPubSub<P>).subscribe(endpoint)
  }

  async confirmSubscription(token: string) {
    if (!this.pubsub) {
      await this.waitPubsubInit()
    }
    await (this.pubsub as SnsPubSub<P>).confirmSubscription(token)
  }

  async publish(message: P) {
    if (!this.pubsub) {
      await this.waitPubsubInit()
    }
    await (this.pubsub as SnsPubSub<P>).publish(message)
  }
}