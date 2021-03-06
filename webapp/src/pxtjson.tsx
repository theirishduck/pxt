import * as React from "react";
import * as pkg from "./package";
import * as srceditor from "./srceditor"
import * as sui from "./sui";
import * as core from "./core";

import Util = pxt.Util;

export class Editor extends srceditor.Editor {
    config: pxt.PackageConfig = {} as any;
    isSaving: boolean;
    changeMade: boolean = false;

    private nameInput: sui.Input;

    prepare() {
        this.isReady = true
    }

    getId() {
        return "pxtJsonEditor"
    }

    hasEditorToolbar() {
        return false
    }

    display() {
        const c = this.config
        const save = () => {
            this.isSaving = true;
            if (!c.name) {
                // Error saving no name
                core.errorNotification(lf("Please choose a project name. It can't be blank."));
                this.isSaving = false;
                return;
            }
            const f = pkg.mainEditorPkg().lookupFile("this/" + pxt.CONFIG_NAME);
            f.setContentAsync(JSON.stringify(this.config, null, 4) + "\n").then(() => {
                pkg.mainPkg.config.name = c.name;
                this.parent.setState({ projectName: c.name });
                this.parent.forceUpdate()
                Util.nextTick(this.changeCallback)
                this.isSaving = false;
                this.changeMade = true;
                // switch to previous coding experience
                this.parent.openPreviousEditor();
                core.resetFocus();
            })
        }
        const setFileName = (v: string) => {
            c.name = v;
            this.parent.forceUpdate();
        }
        let userConfigs: pxt.CompilationConfig[] = [];
        pkg.allEditorPkgs().map(ep => ep.getKsPkg())
            .filter(dep => !!dep && dep.isLoaded && !!dep.config && !!dep.config.yotta && !!dep.config.yotta.userConfigs)
            .forEach(dep => userConfigs = userConfigs.concat(dep.config.yotta.userConfigs));

        const isUserConfigActive = (uc: pxt.CompilationConfig) => {
            const cfg = Util.jsonFlatten(this.config.yotta ? this.config.yotta.config : {});
            const ucfg = Util.jsonFlatten(uc.config);
            return !Object.keys(ucfg).some(k => ucfg[k] === null ? !!cfg[k] : cfg[k] !== ucfg[k]);
        }
        const applyUserConfig = (uc: pxt.CompilationConfig) => {
            const cfg = Util.jsonFlatten(this.config.yotta ? this.config.yotta.config : {});
            const ucfg = Util.jsonFlatten(uc.config);
            if (isUserConfigActive(uc)) {
                Object.keys(ucfg).forEach(k => delete cfg[k]);
            } else {
                Object.keys(ucfg).forEach(k => cfg[k] = ucfg[k]);
            }
            // update cfg
            if (Object.keys(cfg).length) {
                if (!this.config.yotta) this.config.yotta = {};
                Object.keys(cfg).filter(k => cfg[k] === null).forEach(k => delete cfg[k]);
                this.config.yotta.config = Util.jsonUnFlatten(cfg);
            } else {
                if (this.config.yotta) {
                    delete this.config.yotta.config;
                    if (!Object.keys(this.config.yotta).length)
                        delete this.config.yotta;
                }
            }
            // trigger update            
            save();
        }
        return (
            <div className="ui content">
                <h3 className="ui small header">
                    <div className="content">
                        {lf("Project Settings")}
                    </div>
                </h3>
                <div className="ui segment form text">
                    <sui.Input ref={e => this.nameInput = e} id={"fileNameInput"} label={lf("Name") } ariaLabel={lf("Type a name for your project") } value={c.name} onChange={setFileName}/>
                    {userConfigs.map(uc =>
                        <sui.Checkbox
                            key={`userconfig-${uc.description}`}
                            inputLabel={uc.description}
                            checked={isUserConfigActive(uc) }
                            onChange={() => applyUserConfig(uc) } />
                    ) }
                    <sui.Field>
                        <sui.Button text={lf("Save") } className={`green ${this.isSaving ? 'disabled' : ''}`} onClick={() => save() } />
                        <sui.Button text={lf("Edit Settings As text") } onClick={() => this.editSettingsText() } />
                    </sui.Field>
                </div>
            </div>
        )
    }

    isIncomplete() {
        return !this.changeMade;
    }

    editSettingsText() {
        this.changeMade = false;
        this.parent.editText();
    }

    getCurrentSource() {
        return JSON.stringify(this.config, null, 4) + "\n"
    }

    acceptsFile(file: pkg.File) {
        if (file.name != pxt.CONFIG_NAME) return false

        if (file.isReadonly()) {
            // TODO add read-only support
            return false
        }

        try {
            let cfg = JSON.parse(file.content)
            // TODO validate?
            return true;
        } catch (e) {
            return false;
        }
    }

    loadFileAsync(file: pkg.File): Promise<void> {
        this.config = JSON.parse(file.content)
        if (this.nameInput) this.nameInput.clearValue();
        this.setDiagnostics(file, this.snapshotState())
        this.changeMade = false;
        return Promise.resolve();
    }

    unloadFileAsync(): Promise<void> {
        if (this.changeMade) {
            return this.parent.reloadHeaderAsync();
        }
        return Promise.resolve();
    }
}
