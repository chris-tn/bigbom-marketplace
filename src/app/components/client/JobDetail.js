import React, { Component } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import Grid from '@material-ui/core/Grid';
import ButtonBase from '@material-ui/core/ButtonBase';
import renderHTML from 'react-render-html';

import Utils from '../../_utils/utils';
import abiConfig, { fromBlock } from '../../_services/abiConfig';
import services from '../../_services/services';
import Countdown from '../common/countdown';
import DialogPopup from '../common/dialog';
import { BBOTestNetURL } from '../../_services/configs';

import Reasons from '../client/Reasons';
import { saveVotingParams } from '../../actions/freelancerActions';
import Popper from '../common/Popper';
import Rating from '../common/Rating';
import ResponseDispute from './ResponseDispute';
import VoteResult from '../voter/VoteResult';
import LocalStorage from '../../_utils/localStorage';
import { getRatingLogs, setActionBtnDisabled, setReload, setCurrentToken } from '../../actions/commonActions';
import contractApis from '../../_services/contractApis';
import Loading from '../common/Loading';
import CommonLoading from '../common/CommonLoading';

const skillShow = jobSkills => {
    return (
        <div className="skill">
            <span className="bold">Skill required</span>
            {jobSkills.map((skill, i) => {
                return (
                    <span className="tag" key={i}>
                        {skill.label}
                    </span>
                );
            })}
        </div>
    );
};

class JobDetail extends Component {
    constructor(props) {
        super(props);
        this.state = {
            isLoading: false,
            stt: { err: false, text: null },
            actStt: { title: '', err: false, text: null, link: '' },
            dialogLoading: false,
            open: false,
            dialogData: {
                title: null,
                actionText: null,
                actions: null,
            },
            dialogContent: null,
            anchorEl: null,
            disputeStt: {
                clientResponseDuration: 0,
                started: false,
                freelancerProof: { imgs: [], text: '' },
            },
            freelancerDispute: { responded: false, commitDuration: 0 },
            evidenceShow: false,
            checkedDispute: false,
            paymentDuration: 0,
            sttRespondedDispute: false,
            getDisputeDataDone: true,
        };
        this.setActionBtnDisabled = this.props.setActionBtnDisabled;
    }

    async componentDidMount() {
        const { isConnected, saveVotingParams } = this.props;
        const { isLoading } = this.state;
        if (isConnected) {
            if (!isLoading) {
                this.mounted = true;
                this.jobDataInit();
                const votingParams = await contractApis.getVotingParams();
                saveVotingParams(votingParams);
            }
        }
    }

    static getDerivedStateFromProps(props, state) {
        if (props.sttRespondedDispute === state.sttRespondedDispute) {
            return null;
        }
        state.sttRespondedDispute = props.sttRespondedDispute;
        return state;
    }

    componentWillUnmount() {
        this.mounted = false;
        clearInterval(this.checkMetamaskID);
    }

    setDisputeStt = async event => {
        const { jobID } = this.state;
        let clientResponseDuration = event.evidenceEndDate * 1000;
        this.setState({ pollID: event.pollID });
        const URl = abiConfig.getIpfsLink() + event.proofHash;
        if (clientResponseDuration <= Date.now()) {
            clientResponseDuration = 0;
        }
        if (event.revealEndDate <= Date.now()) {
            const isFinal = await contractApis.getDisputeFinalized(jobID);
            if (this.mounted) {
                this.setState({ isFinal });
            }
            this.getDisputeResult();
        }
        fetch(URl)
            .then(res => res.json())
            .then(
                result => {
                    const freelancerProof = {
                        text: result.proof,
                        imgs: result.imgs,
                    };
                    if (this.mounted) {
                        this.setState({
                            disputeStt: { started: event.started, clientResponseDuration, freelancerProof },
                        });
                    }
                },
                error => {
                    console.log(error);
                    if (this.mounted) {
                        this.setState({
                            disputeStt: {
                                started: event.started,
                                clientResponseDuration,
                                freelancerProof: { imgs: [], text: 'Freelancer’s evidence not found!' },
                            },
                        });
                    }
                }
            );
    };

    setRespondedisputeStt = async event => {
        const commitDuration = event.commitEndDate * 1000;
        const evidenceDurtion = event.evidenceEndDate * 1000;
        if (this.mounted) {
            this.setState({ disputeDurations: event });
        }
        if (commitDuration > Date.now() && evidenceDurtion <= Date.now()) {
            if (this.mounted) {
                this.setState({
                    freelancerDispute: { responded: event.responded, commitDuration },
                    disputeStt: {
                        clientResponseDuration: 0,
                        started: true,
                        freelancerProof: { imgs: [], text: '' },
                    },
                    getDisputeDataDone: true,
                });
            }
        } else {
            if (this.mounted) {
                this.setState({ freelancerDispute: { responded: event.responded, commitDuration: 0 }, getDisputeDataDone: true });
            }
        }
        this.setActionBtnDisabled(false);
    };

    setActionBtnStt = async (action, done) => {
        const { match, web3 } = this.props;
        const defaultAccount = await web3.eth.defaultAccount;
        const jobID = match.params.jobId;
        this.setState({ [action]: done });
        LocalStorage.setItemJson(action + '-' + defaultAccount + '-' + jobID, { done });
    };

    getActionBtnStt = async action => {
        const { match, web3 } = this.props;
        const defaultAccount = await web3.eth.defaultAccount;
        const jobID = await match.params.jobId;
        const actionStt = LocalStorage.getItemJson(action + '-' + defaultAccount + '-' + jobID);
        if (actionStt) {
            this.setState({ [action]: actionStt.done });
        } else {
            this.setState({ [action]: false });
        }
    };

    getDisputeResult = async () => {
        const { web3 } = this.props;
        const { pollID } = this.state;
        let voteResult = {};
        const ctInstance = await abiConfig.contractInstanceGenerator(web3, 'BBVotingHelper');
        const [err, result] = await Utils.callMethod(ctInstance.instance.getPollResult)(pollID, {
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
        } else {
            // dispute not response from client
            if (result[1].length < 3) {
                return;
            }
        }
        voteResult = {
            clientVotes: Utils.weiToToken(web3, Number(result[1][2].toString())),
            freelancerVotes: Utils.weiToToken(web3, Number(result[1][1].toString())),
        };
        if (this.mounted) {
            if (voteResult.clientVotes > voteResult.freelancerVotes) {
                this.setState({ voteResult, voteWinner: 'client' });
            } else if (voteResult.clientVotes < voteResult.freelancerVotes) {
                this.setState({ voteResult, voteWinner: 'freelancer' });
            } else {
                this.setState({ voteResult, voteWinner: 'drawn' });
            }
        }
    };

    checkAccount = () => {
        const { reload, setReload } = this.props;
        const { isLoading } = this.state;
        if (!isLoading) {
            if (reload) {
                this.jobDataInit();
                setReload(false);
            }
        }
    };

    viewVotingResult = () => {
        const { voteResult } = this.state;
        this.setState({
            open: true,
            dialogLoading: false,
            dialogContent: <VoteResult voteResult={voteResult} />,
            dialogData: {
                actionText: null,
                actions: null,
            },
            actStt: { title: 'Vote result: ', err: false, text: null, link: '' },
        });
    };

    finalizeDispute = async () => {
        const { web3 } = this.props;
        const { jobID } = this.state;
        this.setState({ dialogLoading: true });
        const ctInstance = await abiConfig.contractInstanceGenerator(web3, 'BBDispute');
        const [err, tx] = await Utils.callMethod(ctInstance.instance.finalizeDispute)(jobID, {
            from: ctInstance.defaultAccount,
            gasPrice: +ctInstance.gasPrice.toString(10),
        });
        if (err) {
            this.setState({
                dialogLoading: false,
                dialogContent: null,
                actStt: { title: 'Error: ', err: true, text: 'Something went wrong! Can not finalize dispute! :(', link: '' },
            });
            console.log(err);
            return;
        }
        this.setState({
            actStt: {
                title: '',
                err: false,
                text: 'Your dispute has been finalized! Please waiting for confirm from your network.',
                link: (
                    <a className="bold link" href={abiConfig.getTXlink() + tx} target="_blank" rel="noopener noreferrer">
                        HERE
                    </a>
                ),
            },
            finalizeDisputeDone: true,
            dialogLoading: false,
            dialogContent: null,
        });
        this.setActionBtnDisabled(true);
    };

    updateDispute = async giveUp => {
        const { web3 } = this.props;
        const { jobID } = this.state;
        this.setState({ dialogLoading: true });
        this.setActionBtnDisabled(true);
        const ctInstance = await abiConfig.contractInstanceGenerator(web3, 'BBDispute');
        const [err, tx] = await Utils.callMethod(ctInstance.instance.updateDispute)(jobID, giveUp, {
            from: ctInstance.defaultAccount,
            gasPrice: +ctInstance.gasPrice.toString(10),
        });
        let text = 'Your request has been sent! Please waiting for confirm from your network.';
        if (err) {
            text = 'Something went wrong! Can not renewal of the dispute! :(';
            if (giveUp) {
                text = 'Something went wrong! Can not give up the dispute! :(';
            }
            this.setState({
                dialogLoading: false,
                dialogContent: null,
                actStt: { title: 'Error: ', err: true, text, link: '' },
            });
            console.log(err);
            this.setActionBtnDisabled(false);
            return;
        }
        this.setState({
            actStt: {
                title: '',
                err: false,
                text,
                link: (
                    <a className="bold link" href={abiConfig.getTXlink() + tx} target="_blank" rel="noopener noreferrer">
                        HERE
                    </a>
                ),
            },
            updateDisputeDone: true,
            dialogLoading: false,
        });
    };

    disputeSttInit = async () => {
        const { match, web3 } = this.props;
        const jobID = match.params.jobId;
        const pollStarted = await contractApis.getEventsPollStarted(jobID, 1);
        this.setDisputeStt(pollStarted);
        // check client dispute response status
        const ctInstance = await abiConfig.contractInstanceGenerator(web3, 'BBDispute');
        const [error, re] = await Utils.callMethod(ctInstance.instance.isAgaintsDispute)(jobID, {
            from: ctInstance.defaultAccount,
            gasPrice: +ctInstance.gasPrice.toString(10),
        });
        if (!error) {
            if (re) {
                const disputeDutations = await contractApis.getEventsPollAgainsted(jobID);
                this.setRespondedisputeStt(disputeDutations);
                return;
            } else {
                if (this.mounted) {
                    this.setState({
                        freelancerDispute: { responded: false, commitDuration: 0, freelancerProof: { imgs: [], text: '' }, getDisputeDataDone: true },
                    });
                }
            }
        }
        this.setState({ getDisputeDataDone: true });
    };

    sttAtionInit = () => {
        this.getActionBtnStt('acceptDone');
        this.getActionBtnStt('rejectPaymentDone');
        this.getActionBtnStt('paymentDone');
        this.getActionBtnStt('cancelDone');
        this.getActionBtnStt('sttRespondedDispute');
        this.getActionBtnStt('claimDepositDone');
    };

    jobDataInit = async () => {
        const { match, web3, history } = this.props;
        const jobID = match.params.jobId;
        this.setState({ isLoading: true, jobID });
        this.sttAtionInit();
        // get job status
        const jobInstance = await abiConfig.contractInstanceGenerator(web3, 'BBFreelancerJob');
        const [err, jobStatusLog] = await Utils.callMethod(jobInstance.instance.getJob)(jobID, {
            from: jobInstance.defaultAccount,
            gasPrice: +jobInstance.gasPrice.toString(10),
        });

        if (err) {
            console.log(err);
            return;
        } else {
            if (jobStatusLog[0] !== web3.eth.defaultAccount) {
                history.push('/freelancer/jobs/' + jobID);
                return;
            }
            const jobStatus = await Utils.getStatus(jobStatusLog);
            if (jobStatus.disputing) {
                this.setState({ getDisputeDataDone: false });
                this.disputeSttInit();
            } else if (jobStatus.reject) {
                const reason = await contractApis.getReasonPaymentRejected(jobID);
                const rejectPaymentDuration = Number(reason.created) * 1000;
                if (this.mounted) {
                    this.setState({ rejectPaymentDuration });
                }
            }
            const employerInfo = await services.getUserByWallet(jobStatusLog[0]);
            let employer = {
                fullName: jobStatusLog[0],
                walletAddress: jobStatusLog[0],
            };
            if (employerInfo !== undefined) {
                employer = {
                    fullName: employerInfo.userInfo.firstName
                        ? employerInfo.userInfo.firstName + ' '
                        : 'N/A ' + employerInfo.userInfo.lastName
                        ? employerInfo.userInfo.lastName
                        : null,
                    walletAddress: jobStatusLog[0],
                };
            }
            jobInstance.instance.JobCreated(
                { jobID },
                {
                    fromBlock: fromBlock, // should use recent number
                    toBlock: 'latest',
                },
                async (JobCreatedErr, JobCreated) => {
                    if (JobCreatedErr) {
                        console.log(JobCreatedErr);
                    } else {
                        // get detail from ipfs
                        const jobHash = Utils.toAscii(JobCreated.args.jobHash);
                        const URl = abiConfig.getIpfsLink() + jobHash;
                        const jobTpl = {
                            jobID,
                            id: jobHash,
                            owner: jobStatusLog[0],
                            ownerInfo: employer,
                            jobHash: jobHash,
                            status: jobStatus,
                            bid: [],
                        };
                        fetch(URl)
                            .then(res => res.json())
                            .then(
                                result => {
                                    jobTpl.title = result.title;
                                    jobTpl.skills = result.skills;
                                    jobTpl.description = result.description;
                                    jobTpl.currency = result.currency;
                                    jobTpl.budget = result.budget;
                                    jobTpl.category = result.category;
                                    jobTpl.estimatedTime = result.estimatedTime;
                                    jobTpl.expiredTime = result.expiredTime;
                                    jobTpl.created = result.created;
                                    this.BidCreatedInit(jobTpl);
                                },
                                error => {
                                    console.log(error);
                                    this.setState({
                                        stt: { title: 'Error: ', err: true, text: 'Can not fetch data from server' },
                                        isLoading: false,
                                        jobData: null,
                                    });
                                    return;
                                }
                            );
                    }
                }
            );
        }
    };

    BidCreatedInit = async job => {
        //console.log('BidCreatedInit', job);
        const jobsMergedBid = await contractApis.mergeBidToJob('BBFreelancerBid', 'BidCreated', { jobID: job.jobID }, job);
        this.BidAcceptedInit(jobsMergedBid);
        const paymentInfo = await contractApis.checkPayment(job.jobID);
        if (this.mounted) {
            this.setState({ ...paymentInfo });
        }
    };

    BidAcceptedInit = async jobData => {
        const bidAcceptedData = await contractApis.getBidAccepted({ jobID: jobData.data.jobID }, jobData.data);
        this.JobsInit(bidAcceptedData);
    };

    jobStarted = async jobStartedData => {
        //console.log('jobStarted', jobData);
        const bidAccepted = jobStartedData.jobData.bid.filter(bid => bid.accepted);
        const jobCompleteDuration = (jobStartedData.jobStarted.created + Number(bidAccepted[0].timeDone) * 60 * 60) * 1000;
        if (this.mounted) {
            this.setState({ jobData: jobStartedData.jobData, isLoading: false, jobCompleteDuration });
        }
    };

    JobsInit = async jobData => {
        //console.log('JobsInit', jobData);
        this.setActionBtnStt('acceptDone', false);
        const { web3, getRatingLogs, setCurrentToken, tokens } = this.props;
        if (jobData.data.currency.label !== 'ETH') {
            const currentToken = {
                symbol: jobData.data.currency.label,
                address: tokens[jobData.data.currency.label],
            };
            setCurrentToken(currentToken);
        }
        if (jobData.data.status.started) {
            const jobStartedData = await contractApis.jobStarted(jobData.data);
            this.jobStarted(jobStartedData);
        } else {
            if (this.mounted) {
                this.setState({ jobData: jobData.data, isLoading: false });
            }
        }
        let listAddress = [jobData.data.owner];
        for (let freelancer of jobData.data.bid) {
            listAddress.push(freelancer.address);
        }
        getRatingLogs({ web3, listAddress });
        this.checkMetamaskID = setInterval(() => {
            this.checkAccount();
        }, 1000);
    };

    acceptBid = async () => {
        const { jobID, bidAddress, jobData, bidValue } = this.state;
        const currency = jobData.currency.label;
        const { web3 } = this.props;
        const BidInstance = await abiConfig.contractInstanceGenerator(web3, 'BBFreelancerBid');
        let msgParam = {
            from: BidInstance.defaultAccount,
            gasPrice: +BidInstance.gasPrice.toString(10),
        };
        if (currency === 'ETH') {
            msgParam.value = bidValue;
        }
        const [errAccept, tx] = await Utils.callMethod(BidInstance.instance.acceptBid)(jobID, bidAddress, msgParam);
        if (errAccept) {
            this.setActionBtnStt('acceptDone', false);
            this.setState({
                dialogLoading: false,
                actStt: { title: 'Error: ', err: true, text: 'Can not accept bid! :(', link: '' },
                dialogContent: null,
            });
            console.log('errAccept', errAccept);
            return;
        }
        if (tx) {
            this.setActionBtnStt('acceptDone', true);
            this.setState({
                actStt: {
                    title: '',
                    err: false,
                    text: 'Your job has been accepted! Please waiting for confirm from your network.',
                    link: (
                        <a className="bold link" href={abiConfig.getTXlink() + tx} target="_blank" rel="noopener noreferrer">
                            HERE
                        </a>
                    ),
                },
                dialogLoading: false,
                dialogContent: null,
            });
        }
    };

    acceptBidInit = async () => {
        const { bidValue, jobData } = this.state;
        const currency = jobData.currency.label;
        const { web3, accountInfo } = this.props;
        const defaultWallet = accountInfo.wallets.filter(wallet => wallet.default);
        const allowance = await contractApis.getAllowance('BBFreelancerBid');
        if (Number(defaultWallet[0].balances.ETH) <= 0) {
            this.setActionBtnDisabled(true);
            this.setState({
                actStt: {
                    title: 'Error: ',
                    err: true,
                    text: 'Sorry, you have insufficient funds! You can not create a job if your ETH balance less than fee.',
                    link: '',
                },
                dialogContent: null,
            });
            return;
        } else if (Utils.tokenToWei(web3, defaultWallet[0].balances[currency]) < Number(bidValue)) {
            this.setActionBtnDisabled(true);
            this.setState({
                actStt: {
                    title: 'Error: ',
                    err: true,
                    text: `Sorry, you have insufficient funds! You can not create a job if your ${currency} balance less than fee.`,
                    link:
                        currency === 'BBO' ? (
                            <a href={BBOTestNetURL} target="_blank" rel="noopener noreferrer">
                                Get free BBO
                            </a>
                        ) : null,
                },
                dialogContent: null,
            });
            return;
        }
        this.setActionBtnDisabled(true);
        this.setState({ dialogLoading: true });

        if (currency === 'ETH') {
            await this.acceptBid();
        } else {
            if (Number(allowance.toString(10)) === 0) {
                const apprv = await contractApis.approve('BBFreelancerBid', Math.pow(2, 255));
                if (apprv) {
                    await this.acceptBid();
                }
            } else if (Number(allowance.toString(10)) > Number(bidValue)) {
                await this.acceptBid();
            } else {
                const apprv = await contractApis.approve('BBFreelancerBid', 0);
                if (apprv) {
                    const apprv2 = await contractApis.approve('BBFreelancerBid', Math.pow(2, 255));
                    if (apprv2) {
                        await this.acceptBid();
                    }
                }
            }
        }
    };

    cancelJob = async () => {
        const { jobID } = this.state;
        const { web3 } = this.props;
        this.setActionBtnDisabled(true);
        this.setState({ dialogLoading: true });
        const jobInstance = await abiConfig.contractInstanceGenerator(web3, 'BBFreelancerJob');
        const [cancelErr, tx] = await Utils.callMethod(jobInstance.instance.cancelJob)(jobID, {
            from: jobInstance.defaultAccount,
            gasPrice: +jobInstance.gasPrice.toString(10),
        });
        if (cancelErr) {
            this.setActionBtnStt('cancelDone', false);
            this.setState({
                dialogLoading: false,
                actStt: { title: 'Error: ', err: true, text: 'Can not cancel job! :(' },
            });
            console.log(cancelErr);
            return;
        }
        this.setActionBtnStt('cancelDone', true);
        this.setState({
            actStt: {
                title: '',
                err: false,
                text: 'Your job has been canceled! Please waiting for confirm from your network.',
                link: (
                    <a className="bold link" href={abiConfig.getTXlink() + tx} target="_blank" rel="noopener noreferrer">
                        HERE
                    </a>
                ),
            },
            dialogLoading: false,
        });
    };

    payment = async () => {
        const { jobID } = this.state;
        const { web3 } = this.props;
        this.setActionBtnDisabled(true);
        this.setState({ dialogLoading: true });
        const jobInstance = await abiConfig.contractInstanceGenerator(web3, 'BBFreelancerPayment');
        const [err, tx] = await Utils.callMethod(jobInstance.instance.acceptPayment)(jobID, {
            from: jobInstance.defaultAccount,
            gasPrice: +jobInstance.gasPrice.toString(10),
        });
        if (err) {
            this.setActionBtnStt('paymentDone', false);
            this.setState({
                dialogLoading: false,
                actStt: { title: 'Error: ', err: true, text: 'Can not payment for this job! :(' },
            });
            console.log(err);
            return;
        }
        this.setActionBtnStt('paymentDone', true);
        this.setState({
            actStt: {
                title: '',
                err: false,
                text: 'Payment success! Please waiting for confirm from your network.',
                link: (
                    <a className="bold link" href={abiConfig.getTXlink() + tx} target="_blank" rel="noopener noreferrer">
                        HERE
                    </a>
                ),
            },
            dialogLoading: false,
            dialogContent: null,
        });
    };

    claimDeposit = async () => {
        const { jobID } = this.state;
        const { web3 } = this.props;
        this.setActionBtnDisabled(true);
        this.setState({ dialogLoading: true });
        const jobInstance = await abiConfig.contractInstanceGenerator(web3, 'BBFreelancerPayment');
        const [err, tx] = await Utils.callMethod(jobInstance.instance.claimePayment)(jobID, {
            from: jobInstance.defaultAccount,
            gasPrice: +jobInstance.gasPrice.toString(10),
        });
        if (err) {
            this.setActionBtnStt('claimDepositDone', false);
            this.setState({
                dialogLoading: false,
                actStt: { title: 'Error: ', err: true, text: 'Can not re-claim your deposit! :(' },
            });
            console.log(err);
            return;
        }
        this.setActionBtnStt('claimDepositDone', true);
        this.setState({
            actStt: {
                title: '',
                err: false,
                text: 'Your request have been sent! Please waiting for confirm from your network.',
                link: (
                    <a className="bold link" href={abiConfig.getTXlink() + tx} target="_blank" rel="noopener noreferrer">
                        HERE
                    </a>
                ),
            },
            dialogLoading: false,
            dialogContent: null,
        });
    };

    rejectPayment = async () => {
        const { jobID } = this.state;
        const { web3, reason } = this.props;
        this.setActionBtnDisabled(true);
        this.setState({ dialogLoading: true, dialogContent: null });
        const jobInstance = await abiConfig.contractInstanceGenerator(web3, 'BBFreelancerPayment');
        const [err, tx] = await Utils.callMethod(jobInstance.instance.rejectPayment)(jobID, reason, {
            from: jobInstance.defaultAccount,
            gasPrice: +jobInstance.gasPrice.toString(10),
        });
        if (err) {
            this.setActionBtnStt('rejectPaymentDone', false);
            this.setState({
                dialogLoading: false,
                actStt: { title: 'Error: ', err: true, text: 'Can not reject payment, please reload page and try again! :(' },
            });
            console.log(err);
            return;
        }
        this.setActionBtnStt('rejectPaymentDone', true);
        this.setState({
            actStt: {
                title: '',
                err: false,
                text: 'Reject payment success! Please waiting for confirm from your network.',
                link: (
                    <a className="bold link" href={abiConfig.getTXlink() + tx} target="_blank" rel="noopener noreferrer">
                        HERE
                    </a>
                ),
            },
            dialogLoading: false,
            dialogContent: null,
        });
    };

    confirmAccept = bid => {
        const { web3 } = this.props;
        const { jobData } = this.state;
        this.setActionBtnDisabled(false);
        const dialogContent = () => {
            return (
                <div className="dialog-note">
                    <i className="fas fa-exclamation-circle" />
                    <p>
                        By confirming this action, you will deposit{' '}
                        <span className="bold">
                            {Utils.currencyFormat(bid.award)} {jobData.currency.label}
                        </span>{' '}
                        into our escrow contract. Please make sure you understand what you&#39;re doing.
                    </p>
                </div>
            );
        };
        this.setState({
            open: true,
            bidAddress: bid.address,
            bidValue: Utils.tokenToWei(web3, bid.award), // convert bbo to eth wei
            dialogData: {
                actionText: 'Accept',
                actions: this.acceptBidInit,
            },
            actStt: { title: 'Do you want to accept bid?', err: false, text: null, link: '' },
            dialogContent: dialogContent(),
        });
    };

    confirmCancelJob = () => {
        this.setActionBtnDisabled(false);
        this.setState({
            dialogData: {
                actionText: 'Cancel',
                actions: this.cancelJob,
            },
            open: true,
            actStt: { title: 'Do you want to cancel this job?', err: false, text: null, link: '' },
            dialogContent: null,
        });
    };

    dialogContentFinalizeDispute = () => {
        const { jobData, voteWinner } = this.state;
        const bidAccepted = jobData.bid.filter(bid => bid.accepted);
        if (voteWinner === 'client') {
            return (
                <div className="dialog-note">
                    <i className="fas fa-exclamation-circle" />
                    <p>
                        By confirming this action, you will get{' '}
                        <span className="bold">
                            {Utils.currencyFormat(bidAccepted[0].award)} {jobData.currency.label}
                        </span>{' '}
                        into your account as the payment for this job. Your staked tokens also will be refunded into your account.
                    </p>
                </div>
            );
        } else {
            return (
                <div className="dialog-note">
                    <i className="fas fa-exclamation-circle" />
                    <p>
                        By confirming this action,{' '}
                        <span className="bold">
                            {Utils.currencyFormat(bidAccepted[0].award)} {jobData.currency.label}
                        </span>{' '}
                        will be sent from escrow contract to winner&#39;s account. If you already staked your tokens, these tokens also will become
                        reward for voters.
                    </p>
                </div>
            );
        }
    };

    confirmFinalizeDispute = () => {
        this.setActionBtnDisabled(false);
        this.setState({
            dialogData: {
                actionText: 'Finalize',
                actions: this.finalizeDispute,
            },
            open: true,
            actStt: { title: 'Do you want to finalize this dispute?', err: false, text: null, link: '' },
            dialogContent: this.dialogContentFinalizeDispute(),
        });
    };

    confirmGiveUpDispute = () => {
        this.setActionBtnDisabled(false);
        this.setState({
            dialogData: {
                actionText: 'Give up',
                actions: () => this.updateDispute(true),
            },
            open: true,
            actStt: { title: 'Do you want to give up this dispute?', err: false, text: null, link: '' },
            dialogContent: null,
        });
    };

    confirmRenewalDispute = () => {
        this.setActionBtnDisabled(false);
        this.setState({
            dialogData: {
                actionText: 'Renewal',
                actions: () => this.updateDispute(false),
            },
            open: true,
            actStt: { title: 'Do you want to renewal of this dispute?', err: false, text: null, link: '' },
            dialogContent: null,
        });
    };

    confirmPayment = () => {
        const { jobData } = this.state;
        this.setActionBtnDisabled(false);
        const bidAccepted = jobData.bid.filter(b => b.accepted);
        const dialogContent = () => {
            return (
                <div className="dialog-note">
                    <i className="fas fa-exclamation-circle" />
                    <p>
                        By confirming this action, you will allow escrow contract to pay your freelancer{' '}
                        <span className="bold">
                            {Utils.currencyFormat(bidAccepted[0].award)} {jobData.currency.label}{' '}
                        </span>{' '}
                        from your deposit balance.
                    </p>
                </div>
            );
        };
        this.setState({
            dialogData: {
                actionText: 'Payment',
                actions: this.payment,
            },
            open: true,
            actStt: { title: 'Do you want to payment for this job?', err: false, text: null, link: '' },
            dialogContent: dialogContent(),
        });
    };

    confirmClaimDeposit = () => {
        const { jobData } = this.state;
        this.setActionBtnDisabled(false);
        const bidAccepted = jobData.bid.filter(b => b.accepted);
        const dialogContent = () => {
            return (
                <div className="dialog-note">
                    <i className="fas fa-exclamation-circle" />
                    <p>
                        By confirming this action, your{' '}
                        <span className="bold">
                            {Utils.currencyFormat(bidAccepted[0].award)} {jobData.currency.label}{' '}
                        </span>{' '}
                        {jobData.currency.label} deposited in the escrow contract will be send back to your account.
                    </p>
                </div>
            );
        };
        this.setState({
            dialogData: {
                actionText: 'Re-claim',
                actions: this.claimDeposit,
            },
            open: true,
            actStt: { title: 'Do you want to re-claim your deposit?', err: false, text: null, link: '' },
            dialogContent: dialogContent(),
        });
    };

    confirmRejectPayment = () => {
        this.setActionBtnDisabled(true);
        this.setState({
            dialogContent: <Reasons />,
            dialogData: {
                actionText: 'Reject Payment',
                actions: this.rejectPayment,
            },
            open: true,
            actStt: { title: 'Do you want to reject payment this job?', err: false, text: null, link: '' },
        });
    };

    handleClose = () => {
        this.setState({ open: false });
    };

    handlePopoverOpen = event => {
        this.setState({ anchorEl: event.currentTarget });
    };

    handlePopoverClose = () => {
        this.setState({ anchorEl: null });
    };

    back = () => {
        const { history } = this.props;
        history.goBack();
    };

    createAction = () => {
        const { history } = this.props;
        history.push('/client');
    };

    handleResponseDispute = () => {
        const { checkedDispute } = this.state;
        this.setState({ checkedDispute: !checkedDispute });
    };

    handleEvidenceShow = () => {
        const { evidenceShow } = this.state;
        this.setState({ evidenceShow: !evidenceShow });
    };

    bidActions = freelancer => {
        const { acceptDone, jobData } = this.state;
        let disabled = acceptDone;
        if (jobData.status.canceled || freelancer.canceled) {
            disabled = true;
        }
        if (jobData.status.bidding) {
            return (
                <ButtonBase aria-label="Cancel" className="btn btn-small btn-blue" onClick={() => this.confirmAccept(freelancer)} disabled={disabled}>
                    <i className="fas fa-check" /> Accept
                </ButtonBase>
            );
        } else {
            return (
                <ButtonBase aria-label="Cancel" className="btn btn-small btn-blue" disabled>
                    <i className="fas fa-check" /> Accept
                </ButtonBase>
            );
        }
    };

    jobActions = () => {
        const { jobData, cancelDone, paymentDone, rejectPaymentDone, disputeStt, rejectPaymentDuration, claimDepositDone } = this.state;
        //console.log(jobData);
        if (jobData.status.bidding || jobData.status.bidAccepted) {
            return (
                <span>
                    <ButtonBase className="btn btn-normal btn-red btn-back btn-bid" disabled={cancelDone} onClick={this.confirmCancelJob}>
                        Cancel
                    </ButtonBase>
                </span>
            );
        } else if (jobData.status.completed) {
            return (
                <span>
                    <ButtonBase className="btn btn-normal btn-blue btn-back btn-bid" disabled={paymentDone} onClick={this.confirmPayment}>
                        Payment
                    </ButtonBase>
                    <ButtonBase
                        className="btn btn-normal btn-orange btn-back btn-bid"
                        disabled={rejectPaymentDone}
                        onClick={this.confirmRejectPayment}
                    >
                        Reject Payment
                    </ButtonBase>
                </span>
            );
        } else if (jobData.status.reject && disputeStt.clientResponseDuration <= 0) {
            if (rejectPaymentDuration <= Date.now()) {
                return (
                    <ButtonBase
                        className="btn btn-normal btn-orange btn-back btn-bid right"
                        disabled={claimDepositDone}
                        onClick={this.confirmClaimDeposit}
                    >
                        Re-claim Deposit
                    </ButtonBase>
                );
            } else {
                return (
                    <div className="note">
                        <span className="bold">You have rejected payment for freelancer</span>, please waiting for response from your freelancer.
                    </div>
                );
            }
        }
    };

    evidence = () => {
        const { disputeStt } = this.state;
        return (
            <div className="evidence-show">
                <p className="bold">Freelancer’s evidence:</p>
                <p>{disputeStt.freelancerProof.text}</p>
            </div>
        );
    };

    disputeActions = () => {
        const {
            disputeStt,
            anchorEl,
            evidenceShow,
            freelancerDispute,
            disputeDurations,
            voteWinner,
            finalizeDisputeDone,
            isFinal,
            updateDisputeDone,
            sttRespondedDispute,
            getDisputeDataDone,
        } = this.state;
        const isPopperOpen = Boolean(anchorEl);
        if (!getDisputeDataDone) {
            return <CommonLoading />;
        }
        if (!freelancerDispute.responded) {
            if (disputeStt.clientResponseDuration > 0) {
                return (
                    <span className="note">
                        <Popper
                            placement="top"
                            anchorEl={anchorEl}
                            id="mouse-over-popover"
                            onClose={this.handlePopoverClose}
                            disableRestoreFocus
                            open={isPopperOpen}
                            content="If you think that your partner is on the right side, you don’t need to do anything. After due date, your partner can claim their payment."
                        />
                        <i className="fas fa-exclamation-circle red" /> <span className="bold">You have a dispute for this job.</span> Do you want to
                        participate into this dipute?{' '}
                        <i
                            className="fas fa-info-circle icon-popper-note"
                            aria-owns={isPopperOpen ? 'mouse-over-popover' : null}
                            aria-haspopup="true"
                            onMouseEnter={this.handlePopoverOpen}
                            onMouseLeave={this.handlePopoverClose}
                        />
                        <ButtonBase
                            className="btn btn-normal btn-blue btn-bid right"
                            disabled={sttRespondedDispute}
                            onClick={this.handleResponseDispute}
                        >
                            Yes
                        </ButtonBase>
                        <ButtonBase onClick={this.handleEvidenceShow} className="btn btn-normal btn-dark-green btn-bid float-right">
                            {evidenceShow ? <i className="fas fa-angle-up icon-popper-note" /> : <i className="fas fa-angle-down icon-popper-note" />}
                            Freelancer&#39;s Evidences
                        </ButtonBase>
                    </span>
                );
            } else {
                return (
                    <span className="note">
                        <Popper
                            placement="top"
                            anchorEl={anchorEl}
                            id="mouse-over-popover"
                            onClose={this.handlePopoverClose}
                            disableRestoreFocus
                            open={isPopperOpen}
                            content="You have a dispute for this job, but during expired duration, you did not do anything."
                        />
                        <i className="fas fa-exclamation-circle red" /> You have a dispute for this job.
                        <span className="bold"> But it was expired</span>
                        &nbsp;
                        <i
                            className="fas fa-info-circle icon-popper-note"
                            aria-owns={isPopperOpen ? 'mouse-over-popover' : null}
                            aria-haspopup="true"
                            onMouseEnter={this.handlePopoverOpen}
                            onMouseLeave={this.handlePopoverClose}
                        />
                        <ButtonBase onClick={this.handleEvidenceShow} className="btn btn-normal btn-dark-green btn-bid float-right">
                            {evidenceShow ? <i className="fas fa-angle-up icon-popper-note" /> : <i className="fas fa-angle-down icon-popper-note" />}
                            Freelancer&#39;s Evidences
                        </ButtonBase>
                    </span>
                );
            }
        } else {
            if (disputeStt.clientResponseDuration > 0) {
                return (
                    <span className="note">
                        <Popper
                            placement="top"
                            anchorEl={anchorEl}
                            id="mouse-over-popover"
                            onClose={this.handlePopoverClose}
                            disableRestoreFocus
                            open={isPopperOpen}
                            content="You have participated a dispute of this job. After Evidence Duration expired, your dispute will be display to voters."
                        />
                        <span className="bold">
                            You have participated a dispute of this job. After Evidence Duration expired, your dispute will be display to voters.
                        </span>
                        <i
                            className="fas fa-info-circle icon-popper-note"
                            aria-owns={isPopperOpen ? 'mouse-over-popover' : null}
                            aria-haspopup="true"
                            onMouseEnter={this.handlePopoverOpen}
                            onMouseLeave={this.handlePopoverClose}
                        />
                    </span>
                );
            } else {
                return disputeDurations.revealEndDate * 1000 <= Date.now() ? (
                    <span className="note">
                        <Popper
                            placement="top"
                            anchorEl={anchorEl}
                            id="mouse-over-drawn"
                            onClose={this.handlePopoverClose}
                            disableRestoreFocus
                            open={isPopperOpen}
                            content="Your dispute has had result, but there is not winner..."
                        />
                        <span className="bold">
                            <i className="fas fa-check-circle orange" />
                            {voteWinner === 'client'
                                ? 'Your dispute has had result and you are winner.'
                                : voteWinner === 'freelancer'
                                ? 'Your dispute has had result and you are losers.'
                                : 'Your dispute has had result, but there is not winner.'}
                            <i
                                className="fas fa-info-circle icon-popper-note"
                                aria-owns={isPopperOpen ? 'mouse-over-drawn' : null}
                                aria-haspopup="true"
                                onMouseEnter={this.handlePopoverOpen}
                                onMouseLeave={this.handlePopoverClose}
                            />
                        </span>
                        <ButtonBase onClick={this.viewVotingResult} className="btn btn-normal btn-blue btn-right">
                            View voting result
                        </ButtonBase>
                        {isFinal ? (
                            <span className="final-stt">Dispute finalized</span>
                        ) : voteWinner === 'drawn' ? (
                            <span className="float-right">
                                <ButtonBase onClick={this.confirmRenewalDispute} className="btn btn-normal btn-green " disabled={updateDisputeDone}>
                                    Renewal
                                </ButtonBase>
                                <ButtonBase
                                    onClick={this.confirmGiveUpDispute}
                                    className="btn btn-normal btn-red btn-right"
                                    disabled={updateDisputeDone}
                                >
                                    Give up
                                </ButtonBase>
                            </span>
                        ) : (
                            <ButtonBase
                                onClick={this.confirmFinalizeDispute}
                                className="btn btn-normal btn-green float-right"
                                disabled={finalizeDisputeDone}
                            >
                                Finalize Dispute
                            </ButtonBase>
                        )}
                    </span>
                ) : (
                    <span className="note">
                        <Popper
                            placement="top"
                            anchorEl={anchorEl}
                            id="mouse-over-popover"
                            onClose={this.handlePopoverClose}
                            disableRestoreFocus
                            open={isPopperOpen}
                            content="You have participated a dipute of this job......"
                        />
                        <span className="bold">You have participated a dipute of this job. Please waiting for result from Voters</span>
                        <i
                            className="fas fa-info-circle icon-popper-note"
                            aria-owns={isPopperOpen ? 'mouse-over-popover' : null}
                            aria-haspopup="true"
                            onMouseEnter={this.handlePopoverOpen}
                            onMouseLeave={this.handlePopoverClose}
                        />
                    </span>
                );
            }
        }
    };

    render() {
        const {
            jobData,
            isLoading,
            stt,
            dialogLoading,
            open,
            actStt,
            dialogData,
            dialogContent,
            checkedDispute,
            disputeStt,
            evidenceShow,
            freelancerDispute,
            paymentDuration,
            sttRespondedDispute,
            jobCompleteDuration,
            rejectPaymentDuration,
        } = this.state;
        const { web3 } = this.props;
        let jobTplRender;
        const ratingOwner = web3.eth.defaultAccount;
        if (stt.err) {
            jobTplRender = () => (
                <Grid container className="single-body">
                    <Grid container>
                        <h2> Sorry. {stt.text} </h2>
                    </Grid>
                </Grid>
            );
        } else {
            if (jobData) {
                jobTplRender = () => {
                    return (
                        <Grid container className="single-body">
                            <Grid container>
                                <div className="top-action">
                                    <ButtonBase onClick={this.back} className="btn btn-normal btn-default btn-back e-left">
                                        <i className="fas fa-angle-left" />
                                        View all Job
                                    </ButtonBase>
                                    <ButtonBase className="btn btn-normal btn-green btn-back" onClick={this.jobDataInit}>
                                        <i className="fas fa-sync-alt" />
                                        Refresh
                                    </ButtonBase>
                                    {this.jobActions()}
                                </div>
                                {disputeStt.started && (
                                    <div className="dispute-actions">
                                        {this.disputeActions()}
                                        {evidenceShow && this.evidence()}
                                    </div>
                                )}
                            </Grid>
                            <Grid container>
                                {!sttRespondedDispute && (
                                    <ResponseDispute
                                        checkedDispute={checkedDispute}
                                        closeAct={this.handleResponseDispute}
                                        jobHash={jobData.jobHash}
                                        jobID={jobData.jobID}
                                        web3={web3}
                                    />
                                )}
                                <Grid container className="job-detail-row">
                                    <Grid item xs={10}>
                                        <Grid container>
                                            <Grid item className="job-detail-col">
                                                <div className="name">Bid</div>
                                                <div className="ct">{jobData.bid.length}</div>
                                            </Grid>
                                            <Grid item className="job-detail-col">
                                                <div className="name">Avg Bid ({jobData.currency.label})</div>
                                                <div className="ct">
                                                    {jobData.bid.length > 0 ? Utils.currencyFormat(Utils.avgBid(jobData.bid)) : 'NaN'}
                                                </div>
                                            </Grid>
                                            <Grid item className="job-detail-col">
                                                <div className="name">Job budget ({jobData.currency.label})</div>
                                                <div className="ct">{Utils.currencyFormat(jobData.budget.max_sum)}</div>
                                            </Grid>
                                            <Grid item className="job-detail-col">
                                                <div className="name">Estimated time</div>
                                                <div className="ct">
                                                    {jobData.estimatedTime < 24
                                                        ? jobData.estimatedTime + ' H'
                                                        : Number.isInteger(jobData.estimatedTime / 24)
                                                        ? jobData.estimatedTime / 24 + ' Days'
                                                        : (jobData.estimatedTime / 24).toFixed(2) + ' Days'}
                                                </div>
                                            </Grid>
                                            {jobData.status.bidding && <Countdown onReload name="Bid duration" expiredTime={jobData.expiredTime} />}
                                            {jobData.status.started && (
                                                <Countdown onReload name="Complete duration" expiredTime={jobCompleteDuration} />
                                            )}
                                            {disputeStt.started &&
                                                (disputeStt.clientResponseDuration > Date.now() && (
                                                    <Countdown onReload name="Evidence Duration" expiredTime={disputeStt.clientResponseDuration} />
                                                ))}
                                            {freelancerDispute.responded &&
                                                (freelancerDispute.commitDuration > Date.now() && (
                                                    <Countdown onReload name="Voting Duration" expiredTime={freelancerDispute.commitDuration} />
                                                ))}
                                            {paymentDuration !== 0 &&
                                                (!jobData.status.reject && !jobData.status.disputing && (
                                                    <Countdown onReload name="Payment duration" expiredTime={paymentDuration} />
                                                ))}

                                            {jobData.status.reject && rejectPaymentDuration && (
                                                <Countdown onReload name="Reject duration" expiredTime={rejectPaymentDuration} />
                                            )}
                                        </Grid>
                                    </Grid>
                                    <Grid item xs={2}>
                                        <Grid item xs className="job-detail-col status">
                                            <div className="name">Status</div>
                                            <div className="ct">{Utils.getStatusJob(jobData.status)}</div>
                                        </Grid>
                                    </Grid>
                                </Grid>
                                <Grid container className="job-detail-description">
                                    <Grid item xs={12} className="name">
                                        Job description
                                    </Grid>
                                    <Grid item xs={12} className="ct">
                                        {renderHTML(jobData.description)}
                                        {skillShow(jobData.skills)}
                                    </Grid>
                                    <Grid item xs={12} className="ct job-owner">
                                        <div className="profile">
                                            <span>Your infomation:</span>
                                            <span className="avatar">
                                                <i className="fas fa-user-circle" />
                                            </span>
                                            {jobData.ownerInfo && <span className="bold">{jobData.ownerInfo.fullName}</span>}
                                        </div>
                                        <Rating jobID={jobData.jobID} ratingOwner={ratingOwner} ratingFor={jobData.owner} />
                                    </Grid>
                                </Grid>

                                <Grid container className="freelancer-bidding">
                                    <h2>Current Bids</h2>
                                    <Grid container className="list-container">
                                        <Grid container className="list-header">
                                            <Grid item xs={4}>
                                                Freelancer
                                            </Grid>
                                            <Grid item xs={3}>
                                                Reputation
                                            </Grid>
                                            <Grid item xs={2}>
                                                Bid Amount
                                            </Grid>
                                            <Grid item xs={1}>
                                                Time
                                            </Grid>
                                            <Grid item xs={2}>
                                                Action
                                            </Grid>
                                        </Grid>
                                        {jobData.bid.length > 0 ? (
                                            <Grid container className="list-body">
                                                {jobData.bid.map(freelancer => {
                                                    return (
                                                        <Grid key={freelancer.address} container className="list-body-row">
                                                            <Grid item xs={4} className={freelancer.accepted ? 'title bold' : 'title'}>
                                                                <span className="avatar">
                                                                    <i className="fas fa-user-circle" />
                                                                </span>
                                                                {freelancer.freelancerInfo.fullName}
                                                                {freelancer.canceled && (
                                                                    <span className="bold">
                                                                        &nbsp;
                                                                        <span className="text-stt-unsuccess">
                                                                            &nbsp;
                                                                            <i className="fas fa-times-circle" />
                                                                            Canceled
                                                                        </span>
                                                                    </span>
                                                                )}
                                                                {freelancer.accepted && (
                                                                    <span className="bold">
                                                                        &nbsp;
                                                                        <span className="text-stt-success">
                                                                            &nbsp;
                                                                            <i className="fas fa-check" />
                                                                            Accepted
                                                                        </span>
                                                                    </span>
                                                                )}
                                                            </Grid>
                                                            <Grid item xs={3} className="Reputation">
                                                                <Rating
                                                                    jobID={jobData.jobID}
                                                                    ratingOwner={ratingOwner}
                                                                    ratingFor={freelancer.address}
                                                                />
                                                            </Grid>
                                                            <Grid item xs={2}>
                                                                <span className="bold">{Utils.currencyFormat(freelancer.award) + ' '}</span>
                                                                &nbsp;
                                                                {jobData.currency.label}
                                                            </Grid>

                                                            <Grid item xs={1}>
                                                                {freelancer.timeDone <= 24
                                                                    ? freelancer.timeDone + ' H'
                                                                    : Number.isInteger(freelancer.timeDone / 24)
                                                                    ? freelancer.timeDone / 24 + ' Days'
                                                                    : (freelancer.timeDone / 24).toFixed(2) + ' Days'}
                                                            </Grid>
                                                            <Grid item xs={2} className="action">
                                                                {this.bidActions(freelancer)}
                                                            </Grid>
                                                        </Grid>
                                                    );
                                                })}
                                            </Grid>
                                        ) : (
                                            <Grid container className="list-body no-data">
                                                This job have no anyone bid yet
                                            </Grid>
                                        )}
                                    </Grid>
                                </Grid>
                            </Grid>
                        </Grid>
                    );
                };
            } else {
                jobTplRender = () => (
                    <Grid container className="single-body">
                        <Grid container />
                    </Grid>
                );
            }
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
                <div id="client" className="container-wrp">
                    <div className="container-wrp full-top-wrp">
                        <div className="container wrapper">
                            <Grid container className="main-intro">
                                <Grid item xs={8}>
                                    {jobData && <h1>{jobData.title}</h1>}
                                </Grid>
                                <Grid item xs={4} className="main-intro-right">
                                    <ButtonBase onClick={this.createAction} className="btn btn-normal btn-white btn-create">
                                        <i className="fas fa-plus" /> Create A New Job
                                    </ButtonBase>
                                </Grid>
                            </Grid>
                        </div>
                    </div>
                    <div className="container-wrp main-ct">
                        <div className="container wrapper">
                            {!isLoading ? (
                                jobTplRender()
                            ) : (
                                <Grid container className="single-body">
                                    <Loading />
                                </Grid>
                            )}
                        </div>
                    </div>
                </div>
            </Grid>
        );
    }
}

JobDetail.propTypes = {
    match: PropTypes.object.isRequired,
    history: PropTypes.object.isRequired,
    web3: PropTypes.object.isRequired,
    isConnected: PropTypes.bool.isRequired,
    accountInfo: PropTypes.any.isRequired,
    reason: PropTypes.number.isRequired,
    setActionBtnDisabled: PropTypes.func.isRequired,
    saveVotingParams: PropTypes.func.isRequired,
    reload: PropTypes.bool.isRequired,
    setReload: PropTypes.func.isRequired,
    getRatingLogs: PropTypes.func.isRequired,
    tokens: PropTypes.object.isRequired,
    setCurrentToken: PropTypes.func.isRequired,
};
const mapStateToProps = state => {
    return {
        web3: state.HomeReducer.web3,
        isConnected: state.HomeReducer.isConnected,
        jobs: state.ClientReducer.jobs,
        reason: state.ClientReducer.reason,
        reload: state.CommonReducer.reload,
        actionBtnDisabled: state.CommonReducer.actionBtnDisabled,
        accountInfo: state.CommonReducer.accountInfo,
        sttRespondedDispute: state.ClientReducer.sttRespondedDispute,
        tokens: state.CommonReducer.tokens,
    };
};

const mapDispatchToProps = {
    setActionBtnDisabled,
    saveVotingParams,
    setReload,
    getRatingLogs,
    setCurrentToken,
};

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(JobDetail);
