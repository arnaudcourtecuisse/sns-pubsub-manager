import debug from 'debug'
import EventEmitter from 'events'
import SnsPubSub from './sns-pub-sub'

/* eslint-disable class-methods-use-this */

const log = debug('sns-pubsub:info')

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

    log('Creating pubsub topic: %s', options.topicName)

    SnsPubSub.client
      .createTopic({ Name: options.topicName })
      .promise()
      .then((response) => {
        if (!response.TopicArn) {
          throw new Error('AWS did not return ARN for created SNS topic')
        }
        this.pubsub = new SnsPubSub<P>(response.TopicArn)
        this.emitter.emit('ready')

        log('Pubsub topic created!')
      })
      .catch((err) => this.emitter.emit('error', err))
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
    if (this.pubsub) {
      return
    }

    return new Promise<void>((resolve, reject) => {
      this.emitter.once('ready', () => {
        this.emitter.removeAllListeners('error')
        resolve()
      })
      this.emitter.once('error', (err) => {
        this.emitter.removeAllListeners('ready')
        reject(err)
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
      log('Waiting for init...')
      await this.waitPubsubInit()
    }
    await (this.pubsub as SnsPubSub<P>).publish(message)
    log('Message published.')
  }
}
