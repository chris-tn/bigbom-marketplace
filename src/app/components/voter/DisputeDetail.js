import React, { Component } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import leftPad from 'left-pad';

import Grid from '@material-ui/core/Grid';
import ButtonBase from '@material-ui/core/ButtonBase';
import CircularProgress from '@material-ui/core/CircularProgress';

import Utils from '../../_utils/utils';
import { setActionBtnDisabled } from '../common/actions';
import abiConfig from '../../_services/abiConfig';
import api from '../../_services/settingsApi';

import Countdown from '../common/countdown';
import DialogPopup from '../common/dialog';
import Voting from './Voting';
import Reveal from './Reveal';
import { setVoteInputDisable } from './actions';

class DisputeDetail extends Component {
    constructor(props) {
        super(props);
        this.state = {
            open: false,
            actStt: { err: false, text: null, link: '' },
            dialogLoading: false,
            dialogData: {
                title: null,
                actionText: null,
                actions: null,
            },
            dialogContent: null,
        };
        this.setActionBtnDisabled = this.props.setActionBtnDisabled;
    }

    componentDidMount() {
        const { isConnected } = this.props;
        const { isLoading } = this.state;
        if (isConnected) {
            if (!isLoading) {
                this.mounted = true;
                this.getDispute();
            }
        }
    }

    componentWillUnmount() {
        this.mounted = false;
    }

    getDispute = async () => {
        const { web3, match } = this.props;
        const jobHash = match.params.disputeId;
        this.setState({ isLoading: true });
        abiConfig.checkDisputeStatus(web3, jobHash, this.disputeDataInit);
    };

    getReasonPaymentRejected = async paymentRejectReason => {
        if (this.mounted) {
            this.setState({ paymentRejectReason });
        }
    };

    getDisputeResult = async jobHash => {
        const { web3 } = this.props;
        const ctInstance = await abiConfig.contractInstanceGenerator(web3, 'BBDispute');
        const [err, result] = await Utils.callMethod(ctInstance.instance.getPoll)(jobHash, {
            from: ctInstance.defaultAccount,
            gasPrice: +ctInstance.gasPrice.toString(10),
        });
        if (err) {
            this.setState({
                dialogLoading: false,
                dialogContent: null,
                actStt: { title: 'Error: ', err: true, text: 'Something went wrong! Can not view result! :(', link: '' },
            });
            console.log(err);
            return;
        }
        this.setState({
            dialogLoading: false,
            dialogContent: null,
            actStt: {
                title: 'Reveal vote: ',
                err: false,
                text: '',
                link: '',
            },
        });
        console.log(result);
    };

    disputeDataInit = async disputeData => {
        //console.log('disputeDataInit',disputeData);
        const { match, web3 } = this.props;
        const jobHash = match.params.disputeId;
        abiConfig.getReasonPaymentRejected(web3, jobHash, this.getReasonPaymentRejected);
        const URl = abiConfig.getIpfsLink() + jobHash;
        const dispute = {
            ...disputeData.data,
            jobDispute: {},
        };
        if (disputeData.data.commitEndDate <= Date.now()) {
            this.setState({ reveal: true });
        }
        fetch(URl)
            .then(res => res.json())
            .then(
                result => {
                    dispute.jobDispute.title = result.title;
                    dispute.jobDispute.skills = result.skills;
                    dispute.jobDispute.category = result.category;
                    dispute.jobDispute.description = result.description;
                    dispute.jobDispute.currency = result.currency;
                    dispute.jobDispute.budget = result.budget;
                    dispute.jobDispute.estimatedTime = result.estimatedTime;
                    dispute.jobDispute.expiredTime = result.expiredTime;
                    dispute.jobDispute.created = result.created;
                    this.clientProofFetch(dispute);
                },
                error => {
                    console.log(error);
                    dispute.err = 'Can not fetch data from server';
                }
            );
    };

    clientProofFetch = async dispute => {
        //console.log('clientProofFetch',dispute);
        const URl = abiConfig.getIpfsLink() + dispute.clientProofHash;
        fetch(URl)
            .then(res => res.json())
            .then(
                result => {
                    dispute.clientProof = result;
                    this.freelancerProofFetch(dispute);
                },
                error => {
                    console.log(error);
                    dispute.err = 'Can not fetch data from server';
                }
            );
    };

    freelancerProofFetch = async dispute => {
        //console.log('freelancerProofFetch', dispute);
        const URl = abiConfig.getIpfsLink() + dispute.freelancerProofHash;
        fetch(URl)
            .then(res => res.json())
            .then(
                result => {
                    dispute.freelancerProof = result;
                    this.disputeListInit(dispute);
                },
                error => {
                    console.log(error);
                    dispute.err = 'Can not fetch data from server';
                }
            );
    };

    disputeListInit = jobDispute => {
        //console.log('disputeListInit success: ', jobDispute);
        if (this.mounted) {
            this.setState({ isLoading: false, disputeData: jobDispute });
        }
    };

    keccak256(...args) {
        const { web3 } = this.props;
        args = args.map(arg => {
            if (typeof arg === 'string') {
                if (arg.substring(0, 2) === '0x') {
                    return arg.slice(2);
                } else {
                    return web3.toHex(arg).slice(2);
                }
            }

            if (typeof arg === 'number') {
                return leftPad(arg.toString(16), 64, 0);
            } else {
                return '';
            }
        });
        args = args.join('');
        return web3.sha3(args, { encoding: 'hex' });
    }

    finalVoting = async () => {
        const { disputeData } = this.state;
        const { web3, vote, setVoteInputDisable } = this.props;
        const ctInstance = await abiConfig.contractInstanceGenerator(web3, 'BBVoting');
        const secretHashString = this.keccak256(vote.choice, Number(vote.secretPhrase));
        const token = Utils.BBOToWei(web3, vote.token);
        setVoteInputDisable(true);
        const [err, tx] = await Utils.callMethod(ctInstance.instance.commitVote)(disputeData.jobHash, secretHashString, token, {
            from: ctInstance.defaultAccount,
            gasPrice: +ctInstance.gasPrice.toString(10),
        });
        if (err) {
            this.setState({
                dialogLoading: false,
                dialogContent: null,
                actStt: { title: 'Error: ', err: true, text: 'Something went wrong! Can not vote! :(', link: '' },
            });
            console.log(err);
            return;
        }
        this.setState({
            dialogLoading: false,
            dialogContent: null,
            actStt: {
                title: '',
                err: false,
                text: 'Your vote has send! Please waiting for confirm from your network.',
                link: (
                    <a className="bold link" href={abiConfig.getTXlink() + tx} target="_blank" rel="noopener noreferrer">
                        HERE
                    </a>
                ),
            },
        });
    };

    submitReveal = async () => {
        const { disputeData } = this.state;
        const { web3, revealVote } = this.props;
        const ctInstance = await abiConfig.contractInstanceGenerator(web3, 'BBVoting');
        const [err, tx] = await Utils.callMethod(ctInstance.instance.revealVote)(
            disputeData.jobHash,
            revealVote.addressChoice,
            Number(revealVote.secretHash),
            {
                from: ctInstance.defaultAccount,
                gasPrice: +ctInstance.gasPrice.toString(10),
            }
        );
        if (!tx) {
            this.setState({
                dialogLoading: false,
                dialogContent: null,
                actStt: { title: 'Error: ', err: true, text: 'Something went wrong! Can not reveal voting! :(', link: '' },
            });
            console.log(err);
            return;
        }
        this.getDisputeResult(disputeData.jobHash);
    };

    // check allowance
    checkAllowance = async () => {
        const { web3, vote, balances, setActionBtnDisabled } = this.props;
        this.setState({ dialogLoading: true });
        setActionBtnDisabled(true);
        const allowance = await abiConfig.getAllowance(web3, 'BBVoting');

        /// check balance
        if (balances.ETH <= 0) {
            this.setState({
                dialogLoading: false,
                actStt: {
                    title: 'Error: ',
                    err: true,
                    text: 'Sorry, you have insufficient funds! You can not create a job if your balance less than fee.',
                    link: '',
                },
            });
            return;
        } else if (Utils.BBOToWei(web3, balances.BBO) < vote.token) {
            this.setState({
                dialogLoading: false,
                actStt: {
                    title: 'Error: ',
                    err: true,
                    text: 'Sorry, you have insufficient funds! You can not create a job if your BBO balance less than stake deposit.',
                    link: (
                        <a href="https://faucet.ropsten.bigbom.net/" target="_blank" rel="noopener noreferrer">
                            Get free BBO
                        </a>
                    ),
                },
            });
            return;
        }

        if (Number(allowance.toString(10)) === 0) {
            const apprv = await abiConfig.approve(web3, 'BBVoting', Math.pow(2, 255));
            if (apprv) {
                await this.finalVoting();
            }
        } else if (Number(allowance.toString(10)) > Utils.BBOToWei(web3, vote.token)) {
            await this.finalVoting();
        } else {
            const apprv = await abiConfig.approve(web3, 'BBVoting', 0);
            if (apprv) {
                const apprv2 = await abiConfig.approve(web3, 'BBVoting', Math.pow(2, 255));
                if (apprv2) {
                    await this.finalVoting();
                }
            }
        }
    };

    votingConfirm = client => {
        const { disputeData } = this.state;
        const options = {
            clientChoice: {
                address: disputeData.client,
                name: 'Client',
            },
            freelancerChoice: {
                address: disputeData.freelancer,
                name: 'Freelancer',
            },
        };

        this.setActionBtnDisabled(true);
        if (client) {
            this.setState({
                open: true,
                dialogContent: <Voting choice="client" dispute={disputeData} options={options} />,
                dialogData: {
                    actionText: 'Submit Vote',
                    actions: this.checkAllowance,
                },
                actStt: { title: 'Do you want to vote for this job?', err: false, text: null, link: '' },
            });
        } else {
            this.setState({
                open: true,
                dialogContent: <Voting choice="freelancer" dispute={disputeData} options={options} />,
                dialogData: {
                    actionText: 'Submit Vote',
                    actions: this.checkAllowance,
                },
                actStt: { title: 'Do you want to vote for this job?', err: false, text: null, link: '' },
            });
        }
    };

    revealConfirm = () => {
        const { disputeData } = this.state;
        this.setActionBtnDisabled(true);
        this.setState({
            open: true,
            dialogContent: <Reveal dispute={disputeData} />,
            dialogData: {
                actionText: 'Reveal Vote',
                actions: this.submitReveal,
            },
            actStt: { title: 'Do you want to reveal your vote?', err: false, text: null, link: '' },
        });
    };

    handleClose = () => {
        this.setState({ open: false });
    };

    back = () => {
        const { history } = this.props;
        history.goBack();
    };

    createAction = () => {
        const { history } = this.props;
        history.push('/client');
    };

    viewFull = () => {
        const { fullCt } = this.state;
        if (!fullCt) {
            document.getElementById('des-ct').classList.add('ct-full');
        } else {
            document.getElementById('des-ct').classList.remove('ct-full');
        }
        this.setState({ fullCt: !fullCt });
    };

    render() {
        const { disputeData, isLoading, dialogLoading, open, actStt, dialogData, dialogContent, fullCt, paymentRejectReason, reveal } = this.state;
        let disputeTplRender;
        const { web3 } = this.props;
        if (disputeData) {
            disputeTplRender = () => {
                return (
                    <Grid container className="single-body">
                        <Grid container>
                            <div className="top-action">
                                <ButtonBase onClick={this.back} className="btn btn-normal btn-default btn-back e-left">
                                    <i className="fas fa-angle-left" />
                                    Back
                                </ButtonBase>
                                <ButtonBase className="btn btn-normal btn-green btn-back" onClick={() => this.getDispute()}>
                                    <i className="fas fa-sync-alt" />
                                    Refresh
                                </ButtonBase>
                                <div className="voting-stage">
                                    {disputeData.evidenceEndDate > Date.now()
                                        ? 'Evidence'
                                        : disputeData.commitEndDate > Date.now()
                                            ? 'Commit Vote'
                                            : disputeData.revealEndDate > Date.now() && 'Reveal Vote'}
                                </div>
                            </div>

                            <Grid item xs={8} className="job-detail-description">
                                <Grid item xs={12} className="name">
                                    Job description
                                </Grid>
                                <Grid item xs={12} className="ct" id="des-ct">
                                    {disputeData.jobDispute.description}
                                </Grid>
                                <Grid item xs={12} className="bottom-ct">
                                    <ButtonBase className="btn btn-small btn-white" onClick={this.viewFull}>
                                        {!fullCt ? (
                                            <span>
                                                More <i className="fas fa-caret-down right" />
                                            </span>
                                        ) : (
                                            <span>
                                                Less <i className="fas fa-caret-up right" />
                                            </span>
                                        )}
                                    </ButtonBase>
                                </Grid>
                            </Grid>
                            <Grid item xs={4} className="job-info">
                                <Grid item xs={12} className={!reveal ? 'commit-duration' : 'commit-duration orange'}>
                                    <p>Remaining time</p>
                                    {!reveal ? (
                                        disputeData.evidenceEndDate > Date.now() ? (
                                            <Countdown expiredTime={disputeData.evidenceEndDate} />
                                        ) : (
                                            <Countdown expiredTime={disputeData.commitEndDate} />
                                        )
                                    ) : (
                                        <Countdown expiredTime={disputeData.revealEndDate} />
                                    )}
                                </Grid>
                                <Grid item xs={12}>
                                    Category:
                                    <span className="bold"> {disputeData.jobDispute.category.label}</span>
                                </Grid>
                                <Grid item xs={12}>
                                    Created:
                                    <span className="bold"> {Utils.convertDateTime(disputeData.jobDispute.created)}</span>
                                </Grid>
                                <Grid item xs={12}>
                                    Budget:
                                    <span className="bold">
                                        &nbsp;
                                        {Utils.currencyFormat(disputeData.jobDispute.budget.max_sum)}
                                        &nbsp;
                                        {disputeData.jobDispute.budget.currency}
                                    </span>
                                </Grid>
                                <Grid item xs={12}>
                                    Dispute reason:&nbsp;
                                    <span className="bold">{paymentRejectReason && api.getReason(Number(paymentRejectReason.reason)).text}</span>
                                </Grid>
                            </Grid>

                            <Grid container className="proofs">
                                <Grid item xs={6} className="client-proof">
                                    <Grid item xs={12} className="header">
                                        Client’s Proof
                                    </Grid>
                                    <Grid item xs={12} className="proof-text">
                                        <p>{disputeData.clientProof.proof}</p>
                                    </Grid>
                                    {!reveal && (
                                        <Grid item xs={12} className="vote-submit">
                                            {disputeData.client === web3.eth.defaultAccount || disputeData.freelancer === web3.eth.defaultAccount ? (
                                                <span className="none-voter">Sorry, Participants in the dispute do not have the right to vote</span>
                                            ) : (
                                                <ButtonBase
                                                    className="btn btn-normal btn-blue"
                                                    onClick={() => this.votingConfirm(true)}
                                                    disabled={disputeData.evidenceEndDate > Date.now()}
                                                >
                                                    VOTE
                                                </ButtonBase>
                                            )}
                                        </Grid>
                                    )}
                                </Grid>
                                <Grid item xs={6} className="freelancer-proof">
                                    <Grid item xs={12} className="header">
                                        Freelancer’s Proof
                                    </Grid>
                                    <Grid item xs={12} className="proof-text">
                                        <p>{disputeData.freelancerProof.proof}</p>
                                    </Grid>
                                    {!reveal && (
                                        <Grid item xs={12} className="vote-submit">
                                            {disputeData.client === web3.eth.defaultAccount || disputeData.freelancer === web3.eth.defaultAccount ? (
                                                <span className="none-voter">Sorry, Participants in the dispute do not have the right to vote</span>
                                            ) : (
                                                <ButtonBase
                                                    className="btn btn-normal btn-blue"
                                                    onClick={() => this.votingConfirm(false)}
                                                    disabled={disputeData.evidenceEndDate > Date.now()}
                                                >
                                                    VOTE
                                                </ButtonBase>
                                            )}
                                        </Grid>
                                    )}
                                </Grid>
                            </Grid>
                            {reveal && (
                                <Grid container className="reveal-submit">
                                    <ButtonBase className="btn btn-normal btn-orange" onClick={this.revealConfirm}>
                                        Reveal Vote
                                    </ButtonBase>
                                </Grid>
                            )}
                        </Grid>
                    </Grid>
                );
            };
        } else {
            disputeTplRender = () => null;
        }

        return (
            <Grid container className="job-detail">
                <DialogPopup
                    dialogLoading={dialogLoading}
                    open={open}
                    stt={actStt}
                    actions={dialogData.actions}
                    title={actStt.title}
                    actionText={dialogData.actionText}
                    actClose={this.handleClose}
                    content={dialogContent}
                />
                <div id="freelancer" className="container-wrp">
                    <div className="container-wrp full-top-wrp">
                        <div className="container wrapper">
                            <Grid container className="main-intro">
                                <Grid item xs={8}>
                                    {disputeData && <h1>{disputeData.jobDispute.title}</h1>}
                                </Grid>
                                <Grid item xs={4} className="main-intro-right">
                                    <ButtonBase onClick={this.createAction} className="btn btn-normal btn-white btn-create">
                                        <i className="fas fa-plus" /> Create A Job Like This
                                    </ButtonBase>
                                </Grid>
                            </Grid>
                        </div>
                    </div>
                    <div className="container-wrp main-ct">
                        <div className="container wrapper">
                            {!isLoading ? (
                                disputeTplRender()
                            ) : (
                                <Grid container className="single-body">
                                    <div className="loading">
                                        <CircularProgress size={50} color="secondary" />
                                        <span>Loading...</span>
                                    </div>
                                </Grid>
                            )}
                        </div>
                    </div>
                </div>
            </Grid>
        );
    }
}

DisputeDetail.propTypes = {
    web3: PropTypes.object.isRequired,
    isConnected: PropTypes.bool.isRequired,
    match: PropTypes.object.isRequired,
    history: PropTypes.object.isRequired,
    setActionBtnDisabled: PropTypes.func.isRequired,
    vote: PropTypes.object.isRequired,
    balances: PropTypes.any.isRequired,
    setVoteInputDisable: PropTypes.func.isRequired,
    revealVote: PropTypes.object.isRequired,
};
const mapStateToProps = state => {
    return {
        web3: state.homeReducer.web3,
        isConnected: state.homeReducer.isConnected,
        disputes: state.voterReducer.disputes,
        balances: state.commonReducer.balances,
        vote: state.voterReducer.vote,
        revealVote: state.voterReducer.revealVote,
    };
};

const mapDispatchToProps = {
    setActionBtnDisabled,
    setVoteInputDisable,
};

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(DisputeDetail);
