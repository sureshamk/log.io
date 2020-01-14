import fs from 'fs'
import os from 'os'
import path from 'path'
import fileInput from './input'
import {FileInputConfig, InputConfig} from './types'

const env = process.env

// Check for ~/.log.io/inputs/file.json
const homedirConfigPath = path.resolve(os.homedir(), '.log.io/inputs/file.json')
const homedirConfigPathExists = fs.existsSync(homedirConfigPath)

// Optional root file path to calculate input file paths
const ROOT_PATH = process.env.LOGIO_FILE_INPUT_ROOT_PATH
const CONFIG_PATH = process.env.LOGIO_FILE_INPUT_CONFIG_PATH
    || (homedirConfigPathExists && homedirConfigPath)
    || path.resolve(__dirname, '../config.json')

function loadConfig(configPath: string): InputConfig {
    const config = JSON.parse(fs.readFileSync(configPath, {encoding: 'utf8'}))
    // if (!!ROOT_PATH) {
    //     config.inputs.forEach((input: FileInputConfig) => {
    //         input.config.path = path.resolve(ROOT_PATH, input.config.path)
    //     })
    // }
    const directoryPath = '/var/log/containers/';
//passsing directoryPath and callback function
    config.inputs = fs.readdirSync(directoryPath).filter(item => !item.includes(env.EXCULDE_NAME)).map((item) => {
        let parsed = item.split('_')

        return {
            'source': parsed[0] || 'unknown',
            'stream': parsed[1] || 'unknown',
            'config': {
                'path': path.join(directoryPath, item)
            }
        };
    });


    return config;
}

(async (): Promise<void> => {
    const config = loadConfig(CONFIG_PATH)
    await fileInput(config)
})().catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e)
})
